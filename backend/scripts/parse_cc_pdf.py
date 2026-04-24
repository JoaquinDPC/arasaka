#!/usr/bin/env python3
"""Parse a Banco de Chile credit card PDF statement into JSON.

Usage: python3 parse_cc_pdf.py --file <path.pdf> --password <pwd>
Output: JSON with national and international statement data.
"""

import re
import json
import argparse
import sys


def _clp(s: str) -> int:
    """'395.005' -> 395005 (absolute value, ignores sign)."""
    return abs(int(re.sub(r'[^0-9]', '', s))) if re.search(r'\d', s) else 0


def _usd_cents(s: str) -> int:
    """'23,80' -> 2380 (absolute value, 2 decimal places)."""
    s = s.strip().lstrip('-')
    s = re.sub(r'\.', '', s)   # remove thousands separator
    s = re.sub(r',', '', s)    # remove decimal comma
    return abs(int(s)) if s.isdigit() else 0


def _date_short(s: str) -> str:
    """'20/02/26' -> '2026-02-20'."""
    d, m, y = s.split('/')
    return f"20{y}-{int(m):02d}-{int(d):02d}"


def _date_long(s: str) -> str:
    """'21/02/2026' -> '2026-02-21'."""
    d, m, y = s.split('/')
    return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"


def _extract_pages(pdf_path: str, password: str) -> list[str]:
    import pypdf
    reader = pypdf.PdfReader(pdf_path)
    if reader.is_encrypted:
        reader.decrypt(password)
    return [page.extract_text() or '' for page in reader.pages]


# ---------------------------------------------------------------------------
# National card
# ---------------------------------------------------------------------------

def _national_items(lines: list[str]) -> list[dict]:
    items = []
    for line in lines:
        if re.search(r'TOTAL|Pago Pesos TEF|LUGAR DE|EMISOR|CLIENTE', line, re.IGNORECASE):
            continue

        m = re.match(
            r'\s*(?:[A-Z][A-Z\s]{0,14}\s+)?'  # optional city prefix
            r'(\d{2}/\d{2}/\d{2})\s+'          # date
            r'(\d{9,})\s+'                      # ref code (≥9 digits)
            r'(.+)',                             # rest of line
            line
        )
        if not m:
            continue

        date_str    = _date_short(m.group(1))
        bank_raw_id = m.group(2)
        rest        = m.group(3)

        # All $ amounts in order; use the LAST one (= monthly charge / cuota)
        amounts = re.findall(r'\$\s*([\d.]+)', rest)
        if not amounts:
            continue
        amount = _clp(amounts[-1])
        if amount == 0:
            continue

        # Installment ratio NN/NN before the last $ sign
        inst_m = re.search(r'(\d{2})/(\d{2})(?=\s+\$)', rest)
        inst_current = inst_total = None
        if inst_m:
            inst_current = int(inst_m.group(1))
            inst_total   = int(inst_m.group(2))

        # Description: text before the first $, strip trailing city and rate info.
        # Cities appear after 2+ spaces in the fixed-width PDF layout.
        desc = rest.split('$')[0].strip()
        desc = re.sub(r'\s+TASA INT\..*$', '', desc, flags=re.IGNORECASE).strip()
        desc = re.sub(r'\s{2,}[A-Z][A-Z\s]*$', '', desc).strip()
        desc = re.sub(r'\s+', ' ', desc)  # normalize internal whitespace
        if not desc:
            continue

        item_type = 'purchase'
        if inst_total and inst_total > 1:
            item_type = 'installment'
        if re.search(r'COMISI[OÓ]N|MANTENCION|COBRO', desc, re.IGNORECASE):
            item_type = 'commission'

        items.append({
            'date':                date_str,
            'description':         desc,
            'amount':              amount,
            'currency':            'CLP',
            'bank_raw_id':         bank_raw_id,
            'installment_current': inst_current,
            'installment_total':   inst_total,
            'item_type':           item_type,
        })
    return items


def parse_national(pages: list[str]) -> dict:
    text = '\n'.join(pages[:3])

    # Period dates: look for "PERÍODO FACTURADO ... PAGAR HASTA ... DATE DATE"
    period_m = re.search(
        r'PERÍODO FACTURADO\s+PAGAR HASTA.+?(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})',
        text, re.DOTALL | re.IGNORECASE,
    )
    period_from = _date_long(period_m.group(1)) if period_m else ''
    period_to   = _date_long(period_m.group(2)) if period_m else ''

    # Due date: first date in COMPROBANTE section
    due_m = re.search(
        r'COMPROBANTE DE PAGO.+?(\d{2}/\d{2}/\d{4})',
        text, re.DOTALL | re.IGNORECASE,
    )
    due_date = _date_long(due_m.group(1)) if due_m else ''

    # Total: section III summary "MONTO TOTAL FACTURADO A PAGAR ( A+... ) $ 395.005"
    total_m = re.search(
        r'MONTO TOTAL FACTURADO A PAGAR[^$\n]*\$\s*([\d.]+)',
        text, re.IGNORECASE,
    )
    total_amount = _clp(total_m.group(1)) if total_m else 0

    # Min payment: on its own line in section III "MONTO MÍNIMO A PAGAR  $  21.566"
    min_m = re.search(
        r'MONTO M[IÍ]NIMO A PAGAR\s+\$\s+([\d.]+)',
        text, re.IGNORECASE,
    )
    min_payment = _clp(min_m.group(1)) if min_m else 0

    return {
        'account_id':   'credit_card_nacional_facturados',
        'period_from':  period_from,
        'period_to':    period_to,
        'due_date':     due_date,
        'currency':     'CLP',
        'total_amount': total_amount,
        'min_payment':  min_payment,
        'items':        _national_items(text.split('\n')),
    }


# ---------------------------------------------------------------------------
# International card
# ---------------------------------------------------------------------------

def _intl_items(lines: list[str]) -> list[dict]:
    items = []
    for line in lines:
        if re.search(r'TOTAL|Pago Dolar TEF|NÚMERO REFERENCIA', line, re.IGNORECASE):
            continue

        # Format: 4DIGIT REF_CODE DATE DESCRIPTION [DOMAIN COUNTRY] AMOUNT  AMOUNT
        # Use 5+ spaces as gap between description block and the amounts
        m = re.match(
            r'\s*\d{4}\s+'              # 4-digit day prefix
            r'([A-Z0-9]{10,})\s+'       # reference code
            r'(\d{2}/\d{2}/\d{2})\s+'  # date
            r'(.*?)'                    # description (non-greedy)
            r'\s{5,}'                   # big gap before amounts
            r'([\d,]+)'                 # first amount (original currency)
            r'\s+([\d,]+)',             # second amount (USD)
            line
        )
        if not m:
            continue

        bank_raw_id = m.group(1)
        date_str    = _date_short(m.group(2))
        desc        = m.group(3).strip()
        amount      = _usd_cents(m.group(5))  # second col = USD

        if amount == 0:
            continue

        # Strip trailing "DOMAIN.TLD COUNTRY" or standalone 2-letter country
        desc = re.sub(r'\s+\S+\.\S+\s+[A-Z]{2}$', '', desc).strip()
        desc = re.sub(r'\s+[A-Z]{2}$', '', desc).strip()

        items.append({
            'date':                date_str,
            'description':         desc,
            'amount':              amount,
            'currency':            'USD',
            'bank_raw_id':         bank_raw_id,
            'installment_current': 1,
            'installment_total':   1,
            'item_type':           'purchase',
        })
    return items


def parse_international(pages: list[str]) -> dict:
    text = '\n'.join(pages[3:])

    # Period dates — same label structure as national
    period_m = re.search(
        r'PERIODO FACTURADO DESDE\s+PERIODO FACTURADO HASTA\s+PAGAR HASTA\s+'
        r'(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})',
        text, re.DOTALL | re.IGNORECASE,
    )
    if period_m:
        period_from = _date_long(period_m.group(1))
        period_to   = _date_long(period_m.group(2))
        due_date    = _date_long(period_m.group(3))
    else:
        # Fallback: first three long dates
        dates = re.findall(r'\b(\d{2}/\d{2}/\d{4})\b', text)
        period_from = _date_long(dates[0]) if len(dates) > 0 else ''
        period_to   = _date_long(dates[1]) if len(dates) > 1 else ''
        due_date    = _date_long(dates[2]) if len(dates) > 2 else ''

    # Total: "TOTAL DE COMPRAS  US$  133,05"
    total_m = re.search(r'TOTAL DE COMPRAS\s+US\$\s+([\d,]+)', text, re.IGNORECASE)
    total_amount = _usd_cents(total_m.group(1)) if total_m else 0

    return {
        'account_id':   'credit_card_internacional_facturados',
        'period_from':  period_from,
        'period_to':    period_to,
        'due_date':     due_date,
        'currency':     'USD',
        'total_amount': total_amount,
        'min_payment':  0,
        'items':        _intl_items(text.split('\n')),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description='Parse Banco de Chile CC PDF to JSON')
    ap.add_argument('--file',     required=True)
    ap.add_argument('--password', required=True)
    args = ap.parse_args()

    try:
        pages = _extract_pages(args.file, args.password)
    except Exception as e:
        print(json.dumps({'error': f'failed to open PDF: {e}'}))
        sys.exit(1)

    result = {
        'national':      parse_national(pages),
        'international': parse_international(pages),
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
