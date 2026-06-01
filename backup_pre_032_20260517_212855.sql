--
-- PostgreSQL database dump
--

\restrict OcPPU2bQfHMdaMGwagXQyxcrrlHPTjsR3JCn5tBQ9PK38Rasu79bNkVkZ5n08SO

-- Dumped from database version 16.13
-- Dumped by pg_dump version 16.13

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.accounts (
    id bigint NOT NULL,
    bank_id text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'corriente'::text NOT NULL,
    currency text DEFAULT 'CLP'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id bigint NOT NULL,
    settings jsonb DEFAULT '{"app_enabled": true, "monthly_salary": 0, "personal_enabled": true, "inference_enabled": true}'::jsonb NOT NULL,
    CONSTRAINT accounts_bank_id_check CHECK ((bank_id = ANY (ARRAY['banco_de_chile'::text, 'santander'::text, 'bci'::text, 'banco_estado'::text, 'scotiabank'::text, 'itau'::text, 'bice'::text, 'falabella'::text, 'ripley'::text, 'mercado_pago'::text, 'otro'::text])))
);


ALTER TABLE public.accounts OWNER TO "arasaka-user";

--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.accounts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_id_seq OWNER TO "arasaka-user";

--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: app_tag_rules; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.app_tag_rules (
    id bigint NOT NULL,
    pattern text NOT NULL,
    tags text[] NOT NULL,
    match_type text DEFAULT 'contains'::text NOT NULL
);


ALTER TABLE public.app_tag_rules OWNER TO "arasaka-user";

--
-- Name: app_tag_rules_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.app_tag_rules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.app_tag_rules_id_seq OWNER TO "arasaka-user";

--
-- Name: app_tag_rules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.app_tag_rules_id_seq OWNED BY public.app_tag_rules.id;


--
-- Name: credit_card_items; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.credit_card_items (
    id bigint NOT NULL,
    statement_id bigint NOT NULL,
    date date NOT NULL,
    description text NOT NULL,
    amount bigint NOT NULL,
    currency text DEFAULT 'CLP'::text NOT NULL,
    installment_current integer,
    installment_total integer,
    item_type text NOT NULL,
    bank_raw_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_id bigint,
    account_id bigint,
    CONSTRAINT credit_card_items_amount_check CHECK ((amount >= 0))
);


ALTER TABLE public.credit_card_items OWNER TO "arasaka-user";

--
-- Name: credit_card_items_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.credit_card_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credit_card_items_id_seq OWNER TO "arasaka-user";

--
-- Name: credit_card_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.credit_card_items_id_seq OWNED BY public.credit_card_items.id;


--
-- Name: credit_card_statements; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.credit_card_statements (
    id bigint NOT NULL,
    external_account_id text NOT NULL,
    period_from date NOT NULL,
    period_to date NOT NULL,
    currency text DEFAULT 'CLP'::text NOT NULL,
    total_amount bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    due_date date,
    min_payment bigint DEFAULT 0 NOT NULL,
    account_id bigint,
    user_id bigint
);


ALTER TABLE public.credit_card_statements OWNER TO "arasaka-user";

--
-- Name: credit_card_statements_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.credit_card_statements_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.credit_card_statements_id_seq OWNER TO "arasaka-user";

--
-- Name: credit_card_statements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.credit_card_statements_id_seq OWNED BY public.credit_card_statements.id;


--
-- Name: goose_db_version; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.goose_db_version (
    id integer NOT NULL,
    version_id bigint NOT NULL,
    is_applied boolean NOT NULL,
    tstamp timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.goose_db_version OWNER TO "arasaka-user";

--
-- Name: goose_db_version_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

ALTER TABLE public.goose_db_version ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public.goose_db_version_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.schema_migrations (
    version integer NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.schema_migrations OWNER TO "arasaka-user";

--
-- Name: tag_budgets; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.tag_budgets (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    year integer NOT NULL,
    month integer DEFAULT 0 NOT NULL,
    amount bigint NOT NULL,
    user_tag_id bigint NOT NULL,
    CONSTRAINT tag_budgets_amount_check CHECK ((amount >= 0))
);


ALTER TABLE public.tag_budgets OWNER TO "arasaka-user";

--
-- Name: tag_budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.tag_budgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tag_budgets_id_seq OWNER TO "arasaka-user";

--
-- Name: tag_budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.tag_budgets_id_seq OWNED BY public.tag_budgets.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.transactions (
    id bigint NOT NULL,
    date date NOT NULL,
    description text NOT NULL,
    flow text NOT NULL,
    amount bigint NOT NULL,
    notes text,
    source text DEFAULT 'manual'::text NOT NULL,
    bank_raw_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    currency text DEFAULT 'CLP'::text NOT NULL,
    cc_statement_id bigint,
    tags text[] DEFAULT '{}'::text[] NOT NULL,
    account_id bigint,
    custom_description text,
    user_id bigint,
    CONSTRAINT transactions_amount_check CHECK ((amount >= 0)),
    CONSTRAINT transactions_flow_check CHECK ((flow = ANY (ARRAY['INCOME'::text, 'EXPENSE'::text, 'INVEST'::text, 'OPENING'::text])))
);


ALTER TABLE public.transactions OWNER TO "arasaka-user";

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.transactions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO "arasaka-user";

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: user_tag_rules; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.user_tag_rules (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    description_key text NOT NULL,
    tags text[] NOT NULL,
    use_count integer DEFAULT 1 NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    custom_description text
);


ALTER TABLE public.user_tag_rules OWNER TO "arasaka-user";

--
-- Name: user_tag_history_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.user_tag_history_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_tag_history_id_seq OWNER TO "arasaka-user";

--
-- Name: user_tag_history_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.user_tag_history_id_seq OWNED BY public.user_tag_rules.id;


--
-- Name: user_tags; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.user_tags (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    tag text NOT NULL,
    icon text,
    color text
);


ALTER TABLE public.user_tags OWNER TO "arasaka-user";

--
-- Name: user_tags_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.user_tags_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_tags_id_seq OWNER TO "arasaka-user";

--
-- Name: user_tags_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.user_tags_id_seq OWNED BY public.user_tags.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: arasaka-user
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    email text NOT NULL,
    password_hash text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO "arasaka-user";

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: arasaka-user
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO "arasaka-user";

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: arasaka-user
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: app_tag_rules id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.app_tag_rules ALTER COLUMN id SET DEFAULT nextval('public.app_tag_rules_id_seq'::regclass);


--
-- Name: credit_card_items id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_items ALTER COLUMN id SET DEFAULT nextval('public.credit_card_items_id_seq'::regclass);


--
-- Name: credit_card_statements id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_statements ALTER COLUMN id SET DEFAULT nextval('public.credit_card_statements_id_seq'::regclass);


--
-- Name: tag_budgets id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.tag_budgets ALTER COLUMN id SET DEFAULT nextval('public.tag_budgets_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: user_tag_rules id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tag_rules ALTER COLUMN id SET DEFAULT nextval('public.user_tag_history_id_seq'::regclass);


--
-- Name: user_tags id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tags ALTER COLUMN id SET DEFAULT nextval('public.user_tags_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.accounts (id, bank_id, name, type, currency, created_at, updated_at, user_id, settings) FROM stdin;
2	banco_de_chile	Banco chile	Cuenta corriente	CLP	2026-04-26 03:11:04.097686+00	2026-04-27 01:21:14.897234+00	1	{"pdf_password": "", "monthly_salary": 0, "app_tag_inference": true, "personal_tag_inference": true}
3	santander	Billetera	Cuenta corriente	CLP	2026-04-27 01:34:33.38817+00	2026-05-13 04:01:42.636884+00	1	{"pdf_password": "", "monthly_salary": 0, "app_tag_inference": true, "personal_tag_inference": true}
4	banco_de_chile	loud8569@gmail.com	Tarjeta de crédito	CLP	2026-05-16 02:41:34.427123+00	2026-05-16 02:41:34.427123+00	1	{"pdf_password": "iHfMgsNuxtRjw459zp2xxFApklV5abIFXDr0Y53wrio=", "monthly_salary": 0, "app_tag_inference": true, "personal_tag_inference": true}
\.


--
-- Data for Name: app_tag_rules; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.app_tag_rules (id, pattern, tags, match_type) FROM stdin;
1	mcdonald	{Comida-rapida}	contains
2	burger king	{Comida-rapida}	contains
3	kfc	{Comida-rapida}	contains
4	uber eats	{Delivery}	contains
5	rappi	{Delivery}	contains
6	pedidosya	{Delivery}	contains
7	netflix	{Suscripciones}	contains
8	spotify	{Suscripciones}	contains
9	amazon	{Suscripciones}	contains
10	apple	{Suscripciones}	contains
11	copec	{Bencina}	contains
12	shell	{Bencina}	contains
13	enex	{Bencina}	contains
14	jumbo	{Supermercado}	contains
15	lider	{Supermercado}	contains
16	unimarc	{Supermercado}	contains
17	santa isabel	{Supermercado}	contains
18	tottus	{Supermercado}	contains
\.


--
-- Data for Name: credit_card_items; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.credit_card_items (id, statement_id, date, description, amount, currency, installment_current, installment_total, item_type, bank_raw_id, created_at, user_id, account_id) FROM stdin;
130	28	2026-01-22	PAYU *UBEREATS SANTIAGO	15093	CLP	1	1	purchase	230172851253	2026-05-12 05:05:55.792157+00	1	\N
131	28	2026-01-23	PAYU *UBEREATS SANTIAGO	959	CLP	1	1	purchase	260173014059	2026-05-12 05:05:55.792157+00	1	\N
132	28	2026-01-28	PAYU *UBEREATS SANTIAGO	10243	CLP	1	1	purchase	290188191808	2026-05-12 05:05:55.792157+00	1	\N
133	28	2026-02-03	LIDERPRATCONCEPCI CONCEPCION	300	CLP	1	1	purchase	040210602417	2026-05-12 05:05:55.792157+00	1	\N
134	28	2026-02-16	SHELL1CLICKMICOP SANTIAGO	25007	CLP	1	1	purchase	170210006280	2026-05-12 05:05:55.792157+00	1	\N
135	28	2025-11-08	MACONLINEPLAZAEL TASAINT. 0,00%	1549990	CLP	3	12	installment	110210250781	2026-05-12 05:05:55.792157+00	1	\N
136	28	2025-12-01	MERCADOPAGO4TCOM TASAINT. 0,00%	1545980	CLP	3	3	installment	110211966746	2026-05-12 05:05:55.792157+00	1	\N
137	28	2026-02-20	COMISIONMENSUALPORMANTENCION	13911	CLP	1	1	commission	200200000000	2026-05-12 05:05:55.792157+00	1	\N
138	29	2026-01-23	OPENAI*CHATGPTSUB OPENAI.COM	2380	USD	\N	\N	purchase	260124492166024100001136385	2026-05-12 05:05:55.798782+00	1	\N
139	29	2026-02-12	GUMROAD*STEVENCOD GUMROAD.COM	1150	USD	\N	\N	purchase	130224011346043100137555091	2026-05-12 05:05:55.798782+00	1	\N
140	29	2026-02-13	CURSOR,AIPOWERED CURSOR.COM	2000	USD	\N	\N	purchase	130224011346044100069964773	2026-05-12 05:05:55.798782+00	1	\N
\.


--
-- Data for Name: credit_card_statements; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.credit_card_statements (id, external_account_id, period_from, period_to, currency, total_amount, created_at, due_date, min_payment, account_id, user_id) FROM stdin;
28	credit_card_nacional_facturados	2026-01-22	2026-02-20	CLP	707967	2026-05-12 05:05:55.790491+00	2026-03-09	0	\N	1
29	credit_card_internacional_facturados	2026-01-22	2026-02-20	USD	5530	2026-05-12 05:05:55.797856+00	2026-03-09	0	\N	1
\.


--
-- Data for Name: goose_db_version; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.goose_db_version (id, version_id, is_applied, tstamp) FROM stdin;
1	0	t	2026-04-18 20:04:26.252583
2	1	t	2026-04-18 20:04:26.260399
3	2	t	2026-04-18 23:20:10.474873
4	3	t	2026-04-19 04:22:43.221205
5	4	t	2026-04-20 02:39:47.905078
6	5	t	2026-04-23 05:01:42.816738
7	6	t	2026-04-25 23:16:05.181919
8	7	t	2026-04-26 04:53:05.991044
9	8	t	2026-04-26 19:26:18.667408
10	9	t	2026-04-26 19:26:18.681732
11	10	t	2026-04-27 01:11:19.794488
12	11	t	2026-04-27 01:34:17.718093
13	12	t	2026-04-28 02:29:44.67684
14	13	t	2026-04-28 02:29:44.687168
15	14	t	2026-04-28 03:46:34.883993
16	15	t	2026-04-28 23:23:44.798019
17	16	t	2026-04-28 23:23:44.812725
18	17	t	2026-05-04 04:39:15.528953
19	18	t	2026-05-04 06:54:04.579531
20	19	t	2026-05-08 03:51:29.966778
21	20	t	2026-05-12 05:27:14.0372
22	21	t	2026-05-13 03:54:32.448853
23	22	t	2026-05-15 04:43:56.007404
24	23	t	2026-05-15 04:43:56.018576
25	25	t	2026-05-15 05:08:17.290905
26	26	t	2026-05-17 00:15:08.869091
27	27	t	2026-05-17 00:29:01.785516
28	28	t	2026-05-17 03:38:24.476703
29	29	t	2026-05-17 04:20:08.206371
30	30	t	2026-05-17 07:30:36.374095
31	31	t	2026-05-17 20:14:49.597846
\.


--
-- Data for Name: schema_migrations; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.schema_migrations (version, applied_at) FROM stdin;
\.


--
-- Data for Name: tag_budgets; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.tag_budgets (id, user_id, year, month, amount, user_tag_id) FROM stdin;
1	1	2026	0	2000000	59
3	1	2026	0	0	60
39	1	2026	0	0	88
40	1	2026	0	0	112
41	1	2026	0	500000	86
42	1	2026	0	0	8
43	1	2026	0	0	108
\.


--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.transactions (id, date, description, flow, amount, notes, source, bank_raw_id, created_at, updated_at, currency, cc_statement_id, tags, account_id, custom_description, user_id) FROM stdin;
828	2026-05-11	Dilan Alejandro Hernandez Molina	INCOME	5000	\N	bank_json	bj_1b1ed88202112dea	2026-05-11 03:18:28.907562+00	2026-05-11 03:18:28.907562+00	CLP	\N	{}	2	\N	1
852	2026-05-14	Samuel Eugenio Andrade	EXPENSE	36160	\N	bank_json	bj_f76c61f35302ddc8	2026-05-15 04:46:28.60037+00	2026-05-15 04:46:28.60037+00	CLP	\N	{Casa,Aseo}	2	Aseo casa	1
829	2026-05-11	Mendoza Ojeda Carolina Loreto	INCOME	5000	\N	bank_json	bj_d639c782ee9d9004	2026-05-11 03:18:28.907562+00	2026-05-17 20:16:27.134042+00	CLP	\N	{}	2	Devolucion uber	1
851	2026-05-12	Retencin Tgr	EXPENSE	4574080	\N	bank_json	bj_0a384d67d078a1a0	2026-05-15 04:46:28.60037+00	2026-05-17 20:19:55.805468+00	CLP	\N	{}	2	Retencion por CAE	1
837	2026-05-11	Meme Banco Estado	EXPENSE	300000	\N	bank_json	bj_f6cbc0e1e280ac84	2026-05-11 03:27:23.041514+00	2026-05-11 03:30:29.031085+00	CLP	\N	{Personal}	2	Presupuesto personal	1
841	2026-05-11	018855668K TRANSF. JOAQUIN ALEJANDRO DEL	INCOME	300000	\N	bank_json	bj_973466803a3e708e	2026-05-12 03:16:04.975614+00	2026-05-12 03:16:04.975614+00	CLP	\N	{}	3	\N	1
842	2026-05-11	COMPRA NACIONAL VD TUU*KELLY	EXPENSE	1380	\N	bank_json	bj_f9da45480750ce5f	2026-05-12 03:16:04.975614+00	2026-05-12 03:16:04.975614+00	CLP	\N	{}	3	\N	1
366	2026-04-27	payu *uber Eats	EXPENSE	29006	\N	bank_json	bj_65c81c896d9481be	2026-04-28 03:11:19.44563+00	2026-04-28 04:10:52.458081+00	CLP	\N	{Agua}	2	\N	1
692	2026-05-04	belsport S.a. Par	EXPENSE	136260	Zapatillas y par de poleras	bank_json	bj_c19c242af50831a7	2026-05-04 06:28:52.036817+00	2026-05-09 23:27:03.093665+00	CLP	\N	{Coni,Regalo}	2	\N	1
1	2026-01-01	Saldo inicial	OPENING	3801639	base del año	excel_import	xl_e27c92845f039c32	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
56	2026-02-02	Personal trainer	EXPENSE	150000	\N	excel_import	xl_200539ec9253e1aa	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
87	2026-03-02	Tarjeta de credito	EXPENSE	707967	\N	excel_import	xl_123445562734b289	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	28	{}	2	\N	1
57	2026-02-02	Mesada a billetera	EXPENSE	500000	\N	excel_import	xl_89078d30c82ec3e5	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
58	2026-02-02	Uber eats	EXPENSE	18290	\N	excel_import	xl_6a645ae328bf5225	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
59	2026-02-05	Aseo	EXPENSE	36160	\N	excel_import	xl_4ed502fc1e3e6274	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
60	2026-02-09	Seguro accidenetes personales	EXPENSE	17461	\N	excel_import	xl_b4600a1fc7bc317c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
61	2026-02-09	Comision bancaria	EXPENSE	1190	Comision Admin. Mensual Plan Cuenta Corriente	excel_import	xl_77ee951aeac41b03	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
62	2026-02-10	Dividendo	EXPENSE	1252086	\N	excel_import	xl_7188f330d723abce	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
63	2026-02-12	Devolucion de plata	INCOME	40400	Pedro reparacion del portón + luz anual	excel_import	xl_bb01fe16907ce644	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
89	2026-03-02	Comida	EXPENSE	70000	\N	excel_import	xl_885e5736c0951d93	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
90	2026-03-02	Mesada a billetera	EXPENSE	500000	\N	excel_import	xl_3708744b8d07e5b0	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
91	2026-03-02	Seguro accidenetes personales	EXPENSE	11945	\N	excel_import	xl_a6b6d2c83d473fcf	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
92	2026-03-02	Copec	EXPENSE	44486	\N	excel_import	xl_10c1ae2fcebe36a1	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
93	2026-03-05	Aseo	EXPENSE	36160	\N	excel_import	xl_933b01709bd660a2	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
94	2026-03-05	Personal trainer	EXPENSE	150000	\N	excel_import	xl_aa69552a04eaf7c4	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
95	2026-03-06	Agua	EXPENSE	14310	\N	excel_import	xl_f33a10de47efd870	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
96	2026-02-09	Luz	EXPENSE	85100	\N	excel_import	xl_13d64237f79db024	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
97	2026-03-09	Seguro accidenetes personales	EXPENSE	17530	\N	excel_import	xl_b8769ce7301b2f5a	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
3	2026-01-01	BTC	INVEST	2250000	Compras de btc 2025	excel_import	xl_6ec7ff2c24b71e6b	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
305	2026-04-02	Samuel Eugenio Andrade	EXPENSE	36160	\N	bank_json	bj_a05bbbaf26fd46ba	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
4	2026-01-02	Sueldo	INCOME	5808296	\N	excel_import	xl_a7764ec2e295cbf4	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
88	2026-03-02	Tarjeta de credito internacional	EXPENSE	49317	\N	excel_import	xl_c7017541a20aee73	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	29	{}	2	\N	1
766	2026-05-08	unired Cl Essbio	EXPENSE	11680	\N	bank_json	bj_fc6e50ea2b2035e9	2026-05-08 04:30:02.200892+00	2026-05-17 23:12:45.227475+00	CLP	\N	{Casa,Agua}	2	Agua	1
5	2026-01-03	???	EXPENSE	3830	\N	excel_import	xl_bd778beba37d1f34	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
327	2026-04-20	paris Mall Plaza	EXPENSE	54244	\N	bank_json	bj_a5a3bb480bf2cab6	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
328	2026-04-20	paris Mall Plaza	EXPENSE	65994	\N	bank_json	bj_5f8aecba7e9b8eaa	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
765	2026-05-07	Samuel Eugenio Andrade	EXPENSE	36160	\N	bank_json	bj_191babb389c4a235	2026-05-08 04:30:02.200892+00	2026-05-08 04:30:02.200892+00	CLP	\N	{Casa,Aseo}	2	Aseo casa	1
64	2026-02-01	Copec	EXPENSE	48945	\N	excel_import	xl_e472e6bf4ea49a85	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
65	2026-02-16	Aseo	EXPENSE	36160	\N	excel_import	xl_41c806de84e7b8ef	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
66	2026-02-16	Regalo	EXPENSE	31011	\N	excel_import	xl_1490da8fc2edd64c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
67	2026-02-16	Sokobox	EXPENSE	81700	Skin care	excel_import	xl_40ce5a21af722277	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
68	2026-02-16	Regalo coni	EXPENSE	350043	Ozempic por 2 meses	excel_import	xl_1acb6bdd76fbe9dd	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
69	2026-02-16	Copec	EXPENSE	34622	Bencina para vacaciones	excel_import	xl_aae65054b9b12a17	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
767	2026-05-08	entel Pcs Pago En	EXPENSE	25980	\N	bank_json	bj_62301063d69fa6d8	2026-05-08 04:30:02.200892+00	2026-05-08 04:36:13.353173+00	CLP	\N	{Personal}	2	Plan celu	1
70	2026-02-17	Retiro en cajero	EXPENSE	200000	Efectivo para vacaciones	excel_import	xl_c524adab5958a433	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
71	2026-02-17	Copec	EXPENSE	25918	Bencina para vacaciones	excel_import	xl_99b592d354484526	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
72	2026-02-23	Transpaso	EXPENSE	10000	Transpaso a cta personal	excel_import	xl_739218aed5889547	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
73	2026-02-23	Restoran Casis	EXPENSE	83270	Desayuno en Casis con los negritos	excel_import	xl_cb7fd1d4309b78dd	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
74	2026-02-23	Bencina	EXPENSE	46000	Bencina para vacaciones	excel_import	xl_b0a286cd704e422f	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
75	2026-02-23	Compra de jugos	EXPENSE	3980	Bencina para vacaciones	excel_import	xl_56879243552bbc28	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
76	2026-02-23	Bencina	EXPENSE	43904	Bencina para vacaciones	excel_import	xl_edf2de53a91bad8a	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
77	2026-02-23	Uber eats	EXPENSE	28236	Burgers de vuelta de vacaciones	excel_import	xl_aa8f81a2d1cd1870	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
78	2026-02-23	Bencina	EXPENSE	20000	Bencina para vacaciones	excel_import	xl_06641532de0a9f46	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
79	2026-02-23	Compra de ropa	EXPENSE	89980	Chaleco gym coni + banano	excel_import	xl_efe595160ab82cb0	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
80	2026-02-23	Devolucion	EXPENSE	13717	Ajuste de salidas a comer con el negro	excel_import	xl_f6b23566b89c5460	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
81	2026-02-24	Pago rutasur	EXPENSE	8000	Cobro de rutasur?	excel_import	xl_9b106d827bdb2114	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
82	2026-02-25	Comision bancaria	EXPENSE	7938	\N	excel_import	xl_75fe51823e565664	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
83	2026-02-26	Uber eats	EXPENSE	11073	\N	excel_import	xl_2aa61d3a6f33fb0e	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
84	2026-02-26	Aseo	EXPENSE	36160	\N	excel_import	xl_78ff1ec4c08ad588	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
85	2026-02-27	Devolucion isapre	INCOME	238	Isapre	excel_import	xl_7ed4fb12645a40d0	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
98	2026-03-09	Proteccion bancaria	EXPENSE	1195	Comision Admin. Mensual Plan Cuenta Corriente	excel_import	xl_0e664b5b677eb0ec	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
100	2026-03-11	Uber	EXPENSE	7068	\N	excel_import	xl_3940ec3bf2b2381a	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
768	2026-05-08	Pago En Servipag.com*	EXPENSE	239400	\N	bank_json	bj_07112e6b0320eaf0	2026-05-08 04:30:02.200892+00	2026-05-10 00:22:53.419875+00	CLP	\N	{Casa,Electricidad}	2	Electricidad casa	1
101	2026-03-11	Telsur	EXPENSE	60964	Pago de 2 meses atrasados, febrero y marzo	excel_import	xl_351940e04cd1c93c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
307	2026-04-06	Giro Cajero Automatico *	EXPENSE	50000	\N	bank_json	bj_a70cc15c4a931bb3	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
312	2026-04-08	Cargo Seguro Proteccion Bancaria	EXPENSE	1195	\N	bank_json	bj_e101a9330e7d54e0	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
315	2026-04-09	Cargo Seguro Accidentes Personales	EXPENSE	17530	\N	bank_json	bj_4b7b87d6fade797b	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
679	2026-04-27	Comision Admin. Mensual Plan Cuenta Corriente	EXPENSE	7965	\N	bank_json	bj_8a76cf73c7d7fe01	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
316	2026-04-10	Pago Automat. Dividendo Hipotecario	EXPENSE	1257284	\N	bank_json	bj_256ff7a9970aa896	2026-04-27 05:03:01.255499+00	2026-04-29 03:29:28.857465+00	CLP	\N	{Casa}	2	\N	1
681	2026-04-28	Cargo Seguro Accidentes Personales	EXPENSE	12032	\N	bank_json	bj_19dbd633ef525598	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
788	2026-03-31	0207786586 TRANSF A PRESUPUESTO DE CASA	EXPENSE	51000	\N	bank_json	bj_10dc93d797406542	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
789	2026-04-02	Intereses Línea de Crédito	EXPENSE	54	\N	bank_json	bj_119290ecb0e4f7e5	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
790	2026-04-02	Impuesto Sobregiro / Uso LCA	EXPENSE	32	\N	bank_json	bj_1e5d4877cfa3937e	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
791	2026-04-02	0202578675 TRANSF DE PABLO ANDREAS YANEZ	INCOME	70000	\N	bank_json	bj_1e739e67befcb104	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
311	2026-04-08	Coniiii	EXPENSE	75000	\N	bank_json	bj_97a3ef0001d75916	2026-04-27 05:03:01.255499+00	2026-05-04 05:18:08.782163+00	CLP	\N	{Agua,Patrimonio}	2	\N	1
309	2026-04-06	copec App	EXPENSE	63155	\N	bank_json	bj_9ca6ff9fdf94ea6f	2026-04-27 05:03:01.255499+00	2026-05-04 05:18:38.155966+00	CLP	\N	{Auto,Combustible}	2	\N	1
308	2026-04-06	Gonzalo Patricio Carrasco Banchieri	INCOME	10000	\N	bank_json	bj_718dd1fb440b8ab3	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
310	2026-04-06	payu *uber Eats	EXPENSE	25870	\N	bank_json	bj_0f0f01d75207db7e	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
313	2026-04-09	Samuel Eugenio Andrade	EXPENSE	36160	\N	bank_json	bj_186c19f6169bce4e	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
314	2026-04-09	dust2	EXPENSE	38161	\N	bank_json	bj_c191f7cd494c46f2	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
317	2026-04-13	payu *uber Eats	EXPENSE	57771	\N	bank_json	bj_bd71b72d39884d0f	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
318	2026-04-13	Julio Alejandro Cuevas	INCOME	28000	\N	bank_json	bj_7e39be8ef7747196	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
333	2026-04-20	Coniiii	EXPENSE	35000	\N	bank_json	bj_5f6e9f12bc339722	2026-04-27 05:03:01.255499+00	2026-05-04 05:23:36.272977+00	CLP	\N	{}	2	\N	1
680	2026-04-28	Meme Banco Estado	EXPENSE	200000	\N	bank_json	bj_a2352b4cb4e92215	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
682	2026-04-28	tuu*kelly	EXPENSE	930	\N	bank_json	bj_4f4d42acf0769756	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
684	2026-04-30	ripley Concepcion	EXPENSE	20270	\N	bank_json	bj_f8b3f73e617dfd22	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
337	2026-04-23	zara Plaza El Tre	EXPENSE	37990	\N	bank_json	bj_04c78079c166cab2	2026-04-27 05:03:01.255499+00	2026-04-28 04:12:41.33729+00	CLP	\N	{Agua}	2	\N	1
335	2026-04-23	Samuel Eugenio Andrade	EXPENSE	36160	\N	bank_json	bj_b4905cdbe0869307	2026-04-27 05:03:01.255499+00	2026-04-29 03:12:54.16643+00	CLP	\N	{Casa,Aseo}	2	\N	1
334	2026-04-21	falabella Concepc	EXPENSE	6990	\N	bank_json	bj_fc293f11735b85c3	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
336	2026-04-23	canadienne Plz El	EXPENSE	79991	\N	bank_json	bj_ada0b6e531e25e8e	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
319	2026-04-13	casa Ideas Mall P	EXPENSE	61420	\N	bank_json	bj_a8f5eb5fca71b0ba	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
320	2026-04-13	falabella Pza. Tr	EXPENSE	69990	\N	bank_json	bj_6342de9c3feca8d5	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
321	2026-04-13	top - Plaza Trebo	EXPENSE	29970	\N	bank_json	bj_4bcf1ed519699249	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
323	2026-04-13	Julio Alejandro Cuevas	INCOME	77200	\N	bank_json	bj_501dbc7849247d7b	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
324	2026-04-15	Manriquez Neguey Edith Marisol	INCOME	500000	\N	bank_json	bj_73a678ecb0adff33	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
325	2026-04-16	Samuel Eugenio Andrade	EXPENSE	36160	\N	bank_json	bj_a1e2956f760e8239	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
329	2026-04-20	telefonica Del Su	EXPENSE	30683	\N	bank_json	bj_f0d82e5167948656	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
330	2026-04-20	tottus Mall Pza E	EXPENSE	48685	\N	bank_json	bj_0f6ff648dfefd641	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
322	2026-04-13	Izakaya Sushi	EXPENSE	154220	\N	bank_json	bj_3abfd22ee34708dd	2026-04-27 05:03:01.255499+00	2026-05-04 05:17:52.28365+00	CLP	\N	{Gustos,Amigos}	2	\N	1
326	2026-04-20	Coniiii	EXPENSE	150000	\N	bank_json	bj_4222b2973df248b2	2026-04-27 05:03:01.255499+00	2026-05-04 05:17:24.946582+00	CLP	\N	{Agua,Patrimonio}	2	\N	1
689	2026-05-04	40560-sbx Vitacur	EXPENSE	26600	\N	bank_json	bj_c7db40b2c896ec3c	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
331	2026-04-20	pago Online Kushk	EXPENSE	15509	\N	bank_json	bj_76de50fb4f7ee00d	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
690	2026-05-04	sumup * Sociedad	EXPENSE	12180	\N	bank_json	bj_3d93e107e7f2f196	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
691	2026-05-04	mercadopago*bdk	EXPENSE	33055	\N	bank_json	bj_d5be57b699ece135	2026-05-04 06:28:52.036817+00	2026-05-04 06:28:52.036817+00	CLP	\N	{}	2	\N	1
332	2026-04-20	mc Donalds	EXPENSE	16580	\N	bank_json	bj_2def0f40884c8240	2026-04-27 05:03:01.255499+00	2026-04-29 03:04:05.659548+00	CLP	\N	{Gustos}	2	\N	1
338	2026-04-27	mercadopago*cassi	EXPENSE	24200	\N	bank_json	bj_ad4def9f5ac78031	2026-04-27 05:03:01.255499+00	2026-05-08 03:03:54.883117+00	CLP	\N	{Gustos,Cafe}	2	\N	1
683	2026-05-01	Goglobal Chile Spa	INCOME	5730453	\N	bank_json	bj_ef450027c6d68a18	2026-05-04 06:28:52.036817+00	2026-05-08 03:07:24.099971+00	CLP	\N	{Sueldo}	2	\N	1
685	2026-05-04	Samuel Eugenio Andrade	EXPENSE	36160	\N	bank_json	bj_89589c431c143da4	2026-05-04 06:28:52.036817+00	2026-05-08 03:56:59.683069+00	CLP	\N	{Casa,Aseo}	2	Aseo casa	1
693	2026-05-04	bumblebee Baby Sp	EXPENSE	49980	\N	bank_json	bj_75534c0a339c0e71	2026-05-04 06:28:52.036817+00	2026-05-09 23:22:21.334018+00	CLP	\N	{Regalo}	2	\N	1
694	2026-05-04	pichintun	EXPENSE	52691	\N	bank_json	bj_d4f32d67f134603d	2026-05-04 06:28:52.036817+00	2026-05-09 23:22:25.256014+00	CLP	\N	{Regalo}	2	\N	1
745	2026-05-04	Cargo Por Pago Tc	EXPENSE	349660	\N	bank_json	bj_7326a89d449431fa	2026-05-06 22:25:59.850978+00	2026-05-09 23:30:44.798193+00	CLP	\N	{}	2	TC Nacional	1
696	2026-05-04	mercadopago*dulce	EXPENSE	59100	\N	bank_json	bj_0ecdf208381e6831	2026-05-04 06:28:52.036817+00	2026-05-09 23:27:27.870907+00	CLP	\N	{Regalo}	2	La barquillería	1
687	2026-05-04	la Birra Chile Sp	EXPENSE	51210	\N	bank_json	bj_6ff846c4e91ae11c	2026-05-04 06:28:52.036817+00	2026-05-09 23:29:46.903286+00	CLP	\N	{Gustos}	2	\N	1
688	2026-05-04	mercadopago*dunki	EXPENSE	31800	\N	bank_json	bj_88765363cd32cae3	2026-05-04 06:28:52.036817+00	2026-05-09 23:29:52.469609+00	CLP	\N	{Gustos}	2	\N	1
695	2026-05-04	oh Bok Bunsik Spa	EXPENSE	88440	Parrillada koreana	bank_json	bj_675c34014e750546	2026-05-04 06:28:52.036817+00	2026-05-09 23:30:07.644849+00	CLP	\N	{Gustos}	2	\N	1
746	2026-05-04	Pago Tarjeta De Credito	EXPENSE	290860	\N	bank_json	bj_192c184299fe4039	2026-05-06 22:25:59.850978+00	2026-05-09 23:30:54.174847+00	CLP	\N	{}	2	TC Internacional	1
112	2026-04-01	Sueldo	INCOME	5734202	\N	excel_import	xl_15b779876a60e802	2026-04-19 04:53:04.662777+00	2026-04-27 01:31:15.286269+00	CLP	\N	{Sueldo}	2	\N	1
339	2026-04-27	kora Sushi Y Good	EXPENSE	68750	\N	bank_json	bj_b4e977fae580d3c3	2026-04-27 05:03:01.255499+00	2026-04-27 05:55:00.100093+00	CLP	\N	{Amigos}	2	\N	1
747	2026-05-05	Sebastian Prado	EXPENSE	25500	Transpaso de 3kg salmón	bank_json	bj_0c92faa800da2934	2026-05-06 22:25:59.850978+00	2026-05-08 02:48:37.145625+00	CLP	\N	{Comida}	2	\N	1
536	2026-03-10	O.Gerencia CompraNacionalSUBWAYLIDERPRATT	EXPENSE	2500	\N	pdf	pdf_54c44e52f25af54b	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
537	2026-03-11	O.Gerencia CompraNacionalC.VERDEB.ARANA599	EXPENSE	8991	\N	pdf	pdf_e76f9fe179cdc1be	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
538	2026-03-12	O.Gerencia CompraNacionalHIPLIDERCONCEPCION	EXPENSE	2962	\N	pdf	pdf_6265373dc54209a3	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
539	2026-03-16	O.Gerencia CompraNacionalPARISMALLPLAZATREBO	EXPENSE	54980	\N	pdf	pdf_7d347b22d13733b2	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
540	2026-03-16	O.Gerencia 018855668KTransfaJoaquinDelPrado	EXPENSE	34450	\N	pdf	pdf_26d9956bc7c8a123	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
541	2026-03-16	O.Gerencia CompraNacionalBBWTREBOL	EXPENSE	11970	\N	pdf	pdf_f4de1bcb9d07b9b0	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
542	2026-03-18	O.Gerencia CompraNacionalMERCADOPAGO*KAUDAT	EXPENSE	7880	\N	pdf	pdf_95443aa2c3a19ac2	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
543	2026-03-20	O.Gerencia CompraNacional	EXPENSE	20000	\N	pdf	pdf_96f2915421b2acb4	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
544	2026-03-20	O.Gerencia CompraNacionalTUU*kelly	EXPENSE	2490	\N	pdf	pdf_aedb18055a1f2df5	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
545	2026-03-23	O.Gerencia CompraNacionalCOMERCIALYOLANDALTDA	EXPENSE	42219	\N	pdf	pdf_a58a41ae54ae2059	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
546	2026-03-24	O.Gerencia CompraNacionalTUU*kelly	EXPENSE	1920	\N	pdf	pdf_28bd19c966295f36	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
547	2026-03-25	O.Gerencia CompraNacionalLONVIA	EXPENSE	18000	\N	pdf	pdf_85278d8fb860bfd3	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
548	2026-03-25	O.Gerencia CompraNacionalESTACIONAMIENTOPORTOF	EXPENSE	5040	\N	pdf	pdf_3798440897674d4e	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
549	2026-03-26	O.Gerencia CompraNacionalCOMERCIALYOLANDALTDA	EXPENSE	4691	\N	pdf	pdf_ce02e68b46206b74	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
550	2026-03-27	Agustinas COM.MANTENCIONPLAN	EXPENSE	20688	\N	pdf	pdf_ce8a7fa28249022f	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
551	2026-03-30	Agustinas 018855668KTransf.JoaquinAlejandroDel	INCOME	500000	\N	pdf	pdf_71e33c2074e99f1c	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
552	2026-03-30	O.Gerencia CompraNacionalCHEVYBURGERALPASOE.I.	EXPENSE	37400	\N	pdf	pdf_70ce3e89173af8d2	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
553	2026-03-30	O.Gerencia CompraNacionalHIPLIDERCONCEPCION	EXPENSE	5790	\N	pdf	pdf_7220d5dffb23b43e	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
554	2026-03-30	O.Gerencia CompraNacionalMERCADOPAGO*7MARKET	EXPENSE	5000	\N	pdf	pdf_dc3cd6f258ec6c9c	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
555	2026-03-30	O.Gerencia CompraNacionalTUU*kelly	EXPENSE	1000	\N	pdf	pdf_2983d82212c7d4f3	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
556	2026-03-31	O.Gerencia 0207786586TransfaPresupuestodecasa	EXPENSE	51000	\N	pdf	pdf_5590f9509704fcd2	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
558	2026-02-02	Agustinas 018855668KTransf.JoaquinAlejandroDel	INCOME	500000	\N	pdf	pdf_76935937cfb34795	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
559	2026-02-02	O.Gerencia CompraNacionalCOMERCIALYOLANDALTDA	EXPENSE	26260	\N	pdf	pdf_ccde836b9ee1bb05	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
560	2026-02-02	O.Gerencia CompraNacionalSTAISABELSANPEDRO	EXPENSE	19740	\N	pdf	pdf_d1d63fc49b73f41b	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
561	2026-02-02	O.Gerencia CompraNacionalAHUML280MICHIMALON1	EXPENSE	7694	\N	pdf	pdf_03ba6c69c333a31d	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
562	2026-02-05	O.Gerencia 0761789880TransfaSOCIEDADFABIANSTU	EXPENSE	58520	\N	pdf	pdf_ad5929e4c38fe197	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
563	2026-02-05	O.Gerencia CompraNacionalTUU*kelly	EXPENSE	790	\N	pdf	pdf_94fcf12182b1e085	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
564	2026-02-09	O.Gerencia 0761789880TransfaSOCIEDADFABIANSTU	EXPENSE	128040	\N	pdf	pdf_11edb68118ec8c9e	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
565	2026-02-09	O.Gerencia CompraNacionalHIPLIDERCONCEPCION	EXPENSE	39538	\N	pdf	pdf_acb8f316d8fe5c5b	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
566	2026-02-10	O.Gerencia CompraNacionalBARBERIABEARBARBERLIMI	EXPENSE	14990	\N	pdf	pdf_f1bd73ab9ba3f708	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
567	2026-02-16	O.Gerencia CompraNacionalJUMBOHUALPEN	EXPENSE	147203	\N	pdf	pdf_919e591a91783941	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
710	2026-05-04	40685 - Aeropuert	EXPENSE	14800	\N	bank_json	bj_9c585b5d9e320142	2026-05-04 06:55:47.243964+00	2026-05-09 23:29:26.22095+00	CLP	\N	{Transporte}	2	\N	1
792	2026-04-06	LIDER PRAT CONCEPCION	EXPENSE	500	\N	bank_json	bj_2775df0780415288	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{Supermercado}	3	\N	1
793	2026-04-06	0209603284 TRANSF A SEBA SANTOS BARBER	EXPENSE	10000	\N	bank_json	bj_f7489a892b986bb9	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
794	2026-04-06	UPITA³ F627 EL CIRUELO	EXPENSE	9870	\N	bank_json	bj_816910afeba82089	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
795	2026-04-06	LA CUCINA D ALESSANDRO	EXPENSE	146520	\N	bank_json	bj_76b7db1f879e17a6	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
796	2026-04-06	MALL PASEO PUERTO VARA	EXPENSE	500	\N	bank_json	bj_79e4ea9e8bae32ea	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
744	2026-05-04	Coniiii	EXPENSE	400000	Transpaso de presupuesto	bank_json	bj_f6a54491f5c8a3a7	2026-05-06 22:25:59.850978+00	2026-05-08 02:45:37.898046+00	CLP	\N	{Casa,Comida}	2	\N	1
775	2026-05-08	Pago Automat. Dividendo Hipotecario	EXPENSE	1268990	\N	bank_json	bj_549e1b48c218f94f	2026-05-09 00:21:11.036688+00	2026-05-09 00:23:34.603031+00	CLP	\N	{Casa}	2	Dividendo	1
774	2026-05-08	Coniiii	EXPENSE	68000	Zapatillas	bank_json	bj_960c8982bdff1ea5	2026-05-09 00:21:11.036688+00	2026-05-09 23:10:42.344404+00	CLP	\N	{Coni,Regalo}	2	\N	1
773	2026-05-08	Coniiii	EXPENSE	177783	Compra casa, ladrillos, tablas y repizas	bank_json	bj_e812d68fe25fc6dd	2026-05-09 00:21:11.036688+00	2026-05-09 23:11:06.183842+00	CLP	\N	{Casa}	2	\N	1
772	2026-05-08	Cargo Seguro Proteccion Bancaria	EXPENSE	1207	\N	bank_json	bj_0bf66faa0fbd0986	2026-05-09 00:21:11.036688+00	2026-05-09 23:15:02.412409+00	CLP	\N	{Personal,Seguros}	2	\N	1
797	2026-04-06	0193362575 TRANSF A EDUARDO MATIAS ARAY	EXPENSE	100000	\N	bank_json	bj_a07ae846622cad69	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
798	2026-04-06	0207786586 TRANSF A CONSTANZA YANEZ	EXPENSE	50000	\N	bank_json	bj_f6391a97af1af5ca	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
799	2026-04-07	0191400348 TRANSF A SEBASTIAN ANDRES PR	EXPENSE	32533	\N	bank_json	bj_9afd57791b178f99	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
800	2026-04-07	COMPRA NACIONAL TUU*KELLY	EXPENSE	1150	\N	bank_json	bj_56f77d37f50552be	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
801	2026-04-09	FUDO *INUGAMI INUGAMI	EXPENSE	54450	\N	bank_json	bj_569fbdffb6bd36f3	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
802	2026-04-10	COMPRA NACIONAL TUU*KELLY	EXPENSE	3320	\N	bank_json	bj_9bcde39002c74b3d	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
803	2026-04-13	MERCADOPAGO*TEAGROUPSPA	EXPENSE	34960	\N	bank_json	bj_3a444a1ea1fe030a	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
804	2026-04-13	PAYSCAN* COCA COLA EM	EXPENSE	1300	\N	bank_json	bj_d63221d92a9b8228	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
805	2026-04-13	MERCADOPAGO*CANTABRIA	EXPENSE	20592	\N	bank_json	bj_9d57c2a44e05beba	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
806	2026-04-14	COMPRA NACIONAL MAXIK	EXPENSE	1690	\N	bank_json	bj_27fd8dede9b1dfe0	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
807	2026-04-15	PANADERIA DRESDEN	EXPENSE	11800	\N	bank_json	bj_63fe0b2f33c56ee2	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
808	2026-04-15	COMPRA NACIONAL TUU*KELLY	EXPENSE	810	\N	bank_json	bj_60c3568cdc2047c8	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
809	2026-04-16	HIP LIDER CONCEPCION	EXPENSE	6370	\N	bank_json	bj_67520998736b328f	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{Supermercado}	3	\N	1
810	2026-04-20	UNDER ARMOUR OUTLET SA	EXPENSE	81584	\N	bank_json	bj_2bbeab7937ba482b	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
811	2026-04-20	TIENDA CFS SN P. DELA	EXPENSE	59990	\N	bank_json	bj_3fcd39412c9d124a	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
812	2026-04-20	TRASPASO CON LA CUENTA N° 001017266450	INCOME	112312	\N	bank_json	bj_add0105cc95547eb	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
813	2026-04-28	018855668K TRANSF. JOAQUIN ALEJANDRO DEL	INCOME	200000	\N	bank_json	bj_c591dbbb1a318246	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
45	2026-01-05	Compra BTC	INVEST	0	\N	excel_import	xl_e3689ef26708303a	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
102	2026-03-11	Plan de celu	EXPENSE	12990	\N	excel_import	xl_4c00e8b5a9629fbe	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
103	2026-03-15	Copec	EXPENSE	46005	\N	excel_import	xl_17d6a91d01193d19	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
104	2026-03-17	Devolucion	INCOME	22326	Movimiento desde banco estado	excel_import	xl_49ba38d8f105d6b2	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
106	2026-03-19	???	EXPENSE	17884	\N	excel_import	xl_2190c998ec727c67	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
107	2026-03-25	Copec	EXPENSE	32400	\N	excel_import	xl_67a909cbd020ea89	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
524	2026-03-02	Agustinas 018855668KTransf.JoaquinAlejandroDel	INCOME	500000	\N	pdf	pdf_61f178751eb61405	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
525	2026-03-02	O.Gerencia 0761789880TransfaSOCIEDADFABIANSTU	EXPENSE	59950	\N	pdf	pdf_2251f4573ac2c754	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
526	2026-03-02	OPER. AmortizaciónPeriódicaLCAN°001017266450	EXPENSE	48739	\N	pdf	pdf_f887520a833fc017	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
527	2026-03-02	O.Gerencia CompraNacionalPRODUCTOSDONKAKO	EXPENSE	24700	\N	pdf	pdf_e9a5fde328c925fc	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
528	2026-03-02	O.Gerencia CompraNacionalUNIMARCLOSHUERTOS	EXPENSE	23260	\N	pdf	pdf_43b1ec514998754f	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
529	2026-03-02	O.Gerencia CompraNacional	EXPENSE	20000	\N	pdf	pdf_5ca48a77150307c0	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
530	2026-03-02	O.Gerencia CompraNacionalCOMERCIALYOLANDALTDA	EXPENSE	11274	\N	pdf	pdf_0fd10167f2703b0a	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
531	2026-03-02	O.Gerencia CompraNacionalMERCADOPAGO*ASSUAN	EXPENSE	11050	\N	pdf	pdf_53352adec1f2a5e2	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
532	2026-03-02	O.Gerencia CompraNacionalPRODUCTOSDONKAKO	EXPENSE	5900	\N	pdf	pdf_8822c67e5b8c2f56	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
533	2026-03-03	EL InteresesLíneadeCrédito	EXPENSE	380	\N	pdf	pdf_4df439fdf0cead26	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
534	2026-03-03	EL ImpuestoSobregiro/UsoLCA	INCOME	25	\N	pdf	pdf_4cd55e6616c4645a	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
535	2026-03-10	O.Gerencia CompraNacionalAHUML417ARTURO651	EXPENSE	10038	\N	pdf	pdf_8ff87c6c1e3e6fd2	2026-04-29 05:17:12.130115+00	2026-04-29 05:17:12.130115+00	CLP	\N	{}	3	\N	1
99	2026-03-10	Dividendo	EXPENSE	1256891	\N	excel_import	xl_d15176e1d3698372	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
786	2026-05-11	Cargo Seguro Accidentes Personales	EXPENSE	17720	\N	bank_json	bj_0b14df43bd83fcf9	2026-05-09 23:01:27.067758+00	2026-05-09 23:02:23.154907+00	CLP	\N	{Personal,Seguros}	2	\N	1
7	2026-01-03	Kelly	EXPENSE	3390	Compra en minimarket kelly	excel_import	xl_ea9077d8f1b82813	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
8	2026-01-03	Compra lider	EXPENSE	95128	Carnecitas año nuevo	excel_import	xl_656a486718d99818	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
9	2026-01-03	Giro de cajero	EXPENSE	50000	\N	excel_import	xl_dc6970e6e177ea1b	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
10	2026-01-03	Farmacia	EXPENSE	41218	Gotitas para los ojos	excel_import	xl_1ccaf3eecdfdba02	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
11	2026-01-03	Estacionamiento	EXPENSE	200	\N	excel_import	xl_16da0d53ff974b90	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
12	2026-01-03	???	EXPENSE	20550	\N	excel_import	xl_986a5edabc77f271	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
13	2026-01-03	Copec	EXPENSE	48855	\N	excel_import	xl_c61c091a6fcf7079	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
14	2026-01-05	Farmacia	EXPENSE	91785	\N	excel_import	xl_7bb2e048de792dfe	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
15	2026-01-05	Peluquería	EXPENSE	25000	\N	excel_import	xl_1419b62417307bcd	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
16	2026-01-05	Comida	EXPENSE	70000	\N	excel_import	xl_98aadeb4723d9f49	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
17	2026-01-05	Devolucion de plata	INCOME	48498	Devolucion cata regalo de mamita suegra	excel_import	xl_058d57e4955e5605	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
18	2026-01-05	Licencia Windows	EXPENSE	8492	\N	excel_import	xl_6968be23af240e27	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
19	2026-01-05	Compra creatina	EXPENSE	89930	\N	excel_import	xl_1a1bbcb302184148	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
20	2026-01-05	Vuelos a santiago	EXPENSE	143184	\N	excel_import	xl_2f906a8ef0bf9be9	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
787	2026-05-11	vivero Katherine	EXPENSE	27500	Bugambilia	bank_json	bj_a989d2a1fab06f83	2026-05-09 23:01:27.067758+00	2026-05-17 20:23:03.158573+00	CLP	\N	{Casa}	2	Pago de bugambilia	1
105	2026-03-19	Aseo	EXPENSE	36160	\N	excel_import	xl_263ac588dbb6fc89	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
28	2026-01-06	Regalo matrimonio ferio	EXPENSE	283920	\N	excel_import	xl_135a68bcc1228b7a	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
29	2026-01-08	Seguro proteccion bancaria	EXPENSE	1193	\N	excel_import	xl_054f3b87779e913e	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
30	2026-01-08	Uber	EXPENSE	7928	\N	excel_import	xl_ac4211a01d53b16c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
31	2026-01-09	Uber	EXPENSE	8302	\N	excel_import	xl_b3ccc864d94f0204	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
32	2026-01-09	Seguro accidenetes personales	EXPENSE	17496	\N	excel_import	xl_04e1b2d4d55e24a2	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
33	2026-01-09	Ajuste de compra	INCOME	7928	Ajuste de compra	excel_import	xl_c1c920448c11f8a1	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
34	2026-01-09	Dividendo	EXPENSE	1254440	\N	excel_import	xl_21497f3ed51318e3	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
35	2026-01-05	Regalo coni	EXPENSE	150000	Regalo para ropa	excel_import	xl_4e84554ebf4dce85	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
36	2026-01-14	Telsur	EXPENSE	30245	\N	excel_import	xl_a975025f0f14d722	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
37	2026-01-16	Plan de celu	EXPENSE	11990	\N	excel_import	xl_5e1bf1d2a9f7a60b	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
38	2026-01-21	Uber	EXPENSE	4000	\N	excel_import	xl_b9feb734b7a8bf26	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
39	2026-01-26	Pago arreglo portón	EXPENSE	110000	Arreglo portón	excel_import	xl_b3fdf426156e9fff	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
40	2026-01-27	Transpaso Gonzalo	INCOME	32000	Devolucion del porton	excel_import	xl_f3cff47331578867	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
41	2026-01-27	Transpaso Patricio	INCOME	32000	Devolucion del porton	excel_import	xl_b06129a30c98984f	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
42	2026-01-28	Seguro accidenetes personales	EXPENSE	11918	\N	excel_import	xl_c15d3214e2280055	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
43	2026-01-28	Comision bancaria	EXPENSE	7942	\N	excel_import	xl_f49f5c52e8417360	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
44	2026-01-29	Aseo	EXPENSE	36160	\N	excel_import	xl_dcdebe1ab014ac4c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
46	2026-02-01	Sueldo	INCOME	5733620	\N	excel_import	xl_76a9ce4308cb35a0	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
785	2026-05-11	maldita Sea Spa	EXPENSE	35200	\N	bank_json	bj_b643b5868c316423	2026-05-09 23:01:27.067758+00	2026-05-09 23:31:51.478099+00	CLP	\N	{Gustos}	2	\N	1
784	2026-05-11	maldita Sea Spa	EXPENSE	17600	\N	bank_json	bj_9cdddf8cc688c0f7	2026-05-09 23:01:27.067758+00	2026-05-09 23:31:54.009749+00	CLP	\N	{Gustos}	2	\N	1
783	2026-05-11	hotel Boutique Y	EXPENSE	69674	\N	bank_json	bj_0fca11356f4dcc4c	2026-05-09 23:01:27.067758+00	2026-05-09 23:31:57.710479+00	CLP	\N	{Gustos}	2	\N	1
814	2026-04-28	Traspaso Internet a Línea Crédito	EXPENSE	112312	\N	bank_json	bj_47ca8101a03e70fa	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
86	2026-03-02	Sueldo	INCOME	5729868	\N	excel_import	xl_688407076f0f3f14	2026-04-19 04:53:04.662777+00	2026-04-27 05:03:42.577107+00	CLP	\N	{Sueldo}	2	\N	1
2	2026-01-01	BTC	INVEST	5010000	Compras de btc 2024	excel_import	xl_0e8fc1b2b26b926f	2026-04-19 04:53:04.662777+00	2026-04-25 05:47:18.877819+00	CLP	\N	{Inversion,Patrimonio}	2	\N	1
686	2026-05-04	mercadopago*cabif	EXPENSE	17980	Transporte aeropuerto al hotel de santiago	bank_json	bj_ca215d8021fb1958	2026-05-04 06:28:52.036817+00	2026-05-09 23:29:30.002216+00	CLP	\N	{Transporte}	2	\N	1
815	2026-04-28	COM.MANTENCION PLAN	EXPENSE	20718	\N	bank_json	bj_133b64e030a289c5	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
816	2026-04-29	COMPRA NACIONAL VD TUU*KELLY	EXPENSE	1090	\N	bank_json	bj_99e34b756f194a1e	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
47	2026-02-01	Devolucion isapre	INCOME	237	Isapre	excel_import	xl_aa305df0c31606fe	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
817	2026-04-30	COMPRA NACIONAL VD SABA CATEDRAL	EXPENSE	11100	\N	bank_json	bj_97487c09510c8a24	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
48	2026-02-02	Devolucion isapre anual	INCOME	27024	Isapre	excel_import	xl_b36025b6d5158564	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
21	2026-01-05	Tarjeta de credito	EXPENSE	1415570	\N	excel_import	xl_e18d89a4c727d263	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
22	2026-01-05	Tarjeta de credito internacional	EXPENSE	40550	\N	excel_import	xl_cbda06b43822f6c3	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
23	2026-01-05	Luz	EXPENSE	117200	\N	excel_import	xl_e7617e2f1f729789	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
24	2026-01-05	Agua	EXPENSE	15830	\N	excel_import	xl_1dc4bbccadabaf82	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
25	2026-01-03	Personal trainer	EXPENSE	150000	\N	excel_import	xl_4863fb6286929f4b	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
26	2026-01-05	Mesada a billetera	EXPENSE	500000	\N	excel_import	xl_fdb19c8ed480d5bc	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
27	2026-01-06	Servicios contables	EXPENSE	16000	\N	excel_import	xl_5c8629a05c20bd7e	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
49	2026-02-02	Comida	EXPENSE	70000	\N	excel_import	xl_69544040a722c9b8	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
50	2026-02-02	Uber eats	EXPENSE	28997	\N	excel_import	xl_02d22cb63f9bdd59	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
51	2026-02-02	Uber	EXPENSE	5060	\N	excel_import	xl_293d171d97ef743e	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
108	2026-03-25	Devolucion	INCOME	90000	Jano por cabaña en pto varas	excel_import	xl_d60bf85eec9429a1	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
109	2026-03-26	Aseo	EXPENSE	36160	\N	excel_import	xl_e8eb06db33aa089c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
110	2026-03-26	Devolucion	INCOME	90000	Negro por cabaña en pto varas	excel_import	xl_9524e7696107857e	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
111	2026-03-26	Comision bancaria	EXPENSE	7954	\N	excel_import	xl_eedfdaaa5ca7fd1a	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
113	2026-04-02	SOAP	EXPENSE	7990	\N	excel_import	xl_e4712bf5a03e54e0	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
114	2026-04-02	Permiso de circulacion	EXPENSE	85185	\N	excel_import	xl_4cbe894c9f70f5d2	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
115	2026-04-02	Tarjeta de credito	EXPENSE	395005	\N	excel_import	xl_b5a1f46303a24441	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
116	2026-04-02	Tarjeta de credito internacional	EXPENSE	125380	\N	excel_import	xl_85b6af1c1dcd6d22	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
117	2026-04-02	Seguro accidenetes personales	EXPENSE	11957	\N	excel_import	xl_d2e12f5371622615	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
118	2026-04-02	Mesada a billetera	EXPENSE	500000	\N	excel_import	xl_eac94bc318105fd1	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
119	2026-04-02	Plan de celu	EXPENSE	12990	\N	excel_import	xl_358b08533d7b5f8d	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
120	2026-04-02	Agua	EXPENSE	15120	\N	excel_import	xl_2263cd7c65c7770c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
121	2026-04-02	Comida	EXPENSE	70000	\N	excel_import	xl_d4117778db41355d	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
306	2026-04-06	Prima Seguro Desgravamen *	EXPENSE	1351	\N	bank_json	bj_fac022a6e92a584c	2026-04-27 05:03:01.255499+00	2026-04-27 05:03:01.255499+00	CLP	\N	{}	2	\N	1
52	2026-02-02	Tarjeta de credito	EXPENSE	916770	\N	excel_import	xl_ffe6c7436650ea10	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
53	2026-02-02	Tarjeta de credito internacional	EXPENSE	39083	\N	excel_import	xl_7e9a3590827af226	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
54	2026-02-02	Luz	EXPENSE	104000	\N	excel_import	xl_21b4477453fd783c	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
55	2026-02-02	Agua	EXPENSE	18610	\N	excel_import	xl_0416f79af5f2ccf2	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
818	2026-05-04	COMPRA NACIONAL VD RUMBO SUR	EXPENSE	8800	\N	bank_json	bj_2cc4558482e7959f	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
819	2026-05-04	COMPRA NACIONAL VD TUU*KELLY	EXPENSE	2100	\N	bank_json	bj_b6f32b040e42d309	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
820	2026-05-05	Intereses Línea de Crédito	EXPENSE	1013	\N	bank_json	bj_2e15d078e143fe40	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
821	2026-05-05	Impuesto Sobregiro / Uso LCA	EXPENSE	74	\N	bank_json	bj_7344a334ef5a1010	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
822	2025-05-11	COMPRA NACIONAL VD MALDITA SEA SPA	EXPENSE	2200	\N	bank_json	bj_15fcfe9632da8fef	2026-05-11 02:10:47.886066+00	2026-05-11 02:10:47.886066+00	CLP	\N	{}	3	\N	1
568	2026-02-16	O.Gerencia CompraNacionalDECATHLONCONCEPCION	EXPENSE	60000	\N	pdf	pdf_c134087e432453a2	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
569	2026-02-16	O.Gerencia CompraNacionalGELATIAMO	EXPENSE	20790	\N	pdf	pdf_d2c69f68f12cf18a	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
570	2026-02-16	O.Gerencia CompraNacionalTOTTUSMALLPZAELTRE	EXPENSE	4980	\N	pdf	pdf_ebe76dae3da075b0	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
571	2026-02-18	O.Gerencia 0163600455TransfaNATALYROXANASILVA	EXPENSE	10360	\N	pdf	pdf_ef9e8e2c547ba5c7	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
572	2026-02-20	OPER. TraspasoconlaCuentaN°001017266450	INCOME	29658	\N	pdf	pdf_632948fd347ea40f	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
573	2026-02-20	O.Gerencia CompraNacionalLACUCINADALESSANDRO	EXPENSE	108493	\N	pdf	pdf_eab027e3833b8bc5	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
574	2026-02-20	O.Gerencia CompraNacionalMERCADOPAGO*ELQUINCHO	EXPENSE	63360	\N	pdf	pdf_89cf4bf8a1e90b4c	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
575	2026-02-23	Agustinas 018855668KTransf.JoaquinAlejandroDel	INCOME	10000	\N	pdf	pdf_ebde417e61ccb5bf	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
576	2026-02-23	OPER. TraspasoconlaCuentaN°001017266450	INCOME	4833	\N	pdf	pdf_01ad37f38e85d775	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
577	2026-02-23	OPER. AmortizaciónPeriódicaLCAN°001017266450	EXPENSE	6400	\N	pdf	pdf_0c8dcfa0edfbba74	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
578	2026-02-23	O.Gerencia CompraNacional	EXPENSE	4833	\N	pdf	pdf_93603cf8e7f48cd0	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
579	2026-02-23	O.Gerencia CompraNacionalTUU*BLUEPOINTSPA	EXPENSE	3600	\N	pdf	pdf_7dd66f0e04867b4e	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
580	2026-02-25	OPER. TraspasoconlaCuentaN°001017266450	INCOME	20648	\N	pdf	pdf_061e0a106b9b29e4	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
581	2026-02-25	Agustinas COM.MANTENCIONPLAN	EXPENSE	20648	\N	pdf	pdf_abed9133a0c3756c	2026-04-29 05:17:12.149208+00	2026-04-29 05:17:12.149208+00	CLP	\N	{}	3	\N	1
583	2026-01-05	Agustinas 018855668KTransf.JoaquinAlejandroDel	INCOME	500000	\N	pdf	pdf_df4f9b796dbe6e9b	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
599	2026-01-12	O.Gerencia CompraNacional	EXPENSE	1188	\N	pdf	pdf_5b56a5dd5cde79ad	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
600	2026-01-15	O.Gerencia 0188222706TransfaJulioCuevas	EXPENSE	74234	\N	pdf	pdf_0d450e96abe103c1	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
601	2026-01-16	O.Gerencia 0207786586TransfaConstanzaYanez	EXPENSE	65000	\N	pdf	pdf_4edff9c3d96f4dc1	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
602	2026-01-19	O.Gerencia CompraNacionalTUU*KELLY	EXPENSE	2450	\N	pdf	pdf_914d8184b6ba857d	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
603	2026-01-19	O.Gerencia CompraNacionalTUU*KELLY	EXPENSE	950	\N	pdf	pdf_a30e612582ea45a0	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
604	2026-01-20	O.Gerencia CompraNacionalSHELLMICHIMALONCOF32	EXPENSE	49513	\N	pdf	pdf_534aa2573fbdb758	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
605	2026-01-20	O.Gerencia 0207786586TransfaConstanzaYanez	EXPENSE	38675	\N	pdf	pdf_8779dbe5253aaa6d	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
606	2026-01-21	O.Gerencia CompraNacionalTUU*KELLY	EXPENSE	900	\N	pdf	pdf_d6c813673879cc21	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
607	2026-01-26	O.Gerencia CompraNacionalHIPLIDERCONCEPCION	EXPENSE	2850	\N	pdf	pdf_17ef6d9cb7bfd582	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
608	2026-01-28	Agustinas COM.MANTENCIONPLAN	EXPENSE	20657	\N	pdf	pdf_556fdb6b5678f1e8	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
609	2026-01-29	O.Gerencia CompraNacionalLASMARGARITAS	EXPENSE	19657	\N	pdf	pdf_63ef5b37e92ae0a1	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
6	2026-01-03	Devolucion isapre	INCOME	237	Isapre	excel_import	xl_4235914ed4392af0	2026-04-19 04:53:04.662777+00	2026-04-19 04:53:04.662777+00	CLP	\N	{}	2	\N	1
584	2026-01-05	O.Gerencia 0191400348TransfdeSEBASTIANANDRESPR	INCOME	300000	\N	pdf	pdf_8e8f3646b8373887	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
585	2026-01-05	O.Gerencia CompraNacionalTUU*KELLY	EXPENSE	3400	\N	pdf	pdf_bbf9fc5478b459aa	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
586	2026-01-06	O.Gerencia 0777975757TransfaContymeAuditoresy	EXPENSE	16000	\N	pdf	pdf_a2a19a5bfb171aed	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
587	2026-01-07	O.Gerencia 0777975757TransfaContymeAuditoresy	EXPENSE	8000	\N	pdf	pdf_1d48305acee200b6	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
588	2026-01-07	O.Gerencia CompraNacionalTUU*KELLY	EXPENSE	3310	\N	pdf	pdf_3de6140a735bd119	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
589	2026-01-08	O.Gerencia 0777425382TransfaMakingsushi	EXPENSE	74470	\N	pdf	pdf_a90bfab0454cf758	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
590	2026-01-09	O.Gerencia CompraNacionalTUU*KELLY	EXPENSE	11250	\N	pdf	pdf_30e4f5c472cca4ac	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
591	2026-01-12	O.Gerencia CompraNacionalFINAESTAMPA	EXPENSE	94050	\N	pdf	pdf_96b32960a0ee2938	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
592	2026-01-12	O.Gerencia CompraNacionalLACOCINASPA	EXPENSE	66660	\N	pdf	pdf_7d70a4b3e4abf7bd	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
593	2026-01-12	O.Gerencia CompraNacionalSHELLMICHIMALONCOF32	EXPENSE	46903	\N	pdf	pdf_14f027e2987fad1e	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
594	2026-01-12	O.Gerencia CompraNacionalCARROUSELPASTELERIA	EXPENSE	14300	\N	pdf	pdf_881f3afa5387b710	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
595	2026-01-12	O.Gerencia CompraNacionalCASAROYAL	EXPENSE	6990	\N	pdf	pdf_cd9d7e2e098e0ccf	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
596	2026-01-12	O.Gerencia CompraNacional	EXPENSE	6215	\N	pdf	pdf_449fa2b02309df0e	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
597	2026-01-12	O.Gerencia CompraNacionalTUU*KELLY	EXPENSE	5400	\N	pdf	pdf_60af8bf4fe3df543	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
598	2026-01-12	O.Gerencia CompraNacionalAEROPUERTOCARRIELSUR	EXPENSE	3000	\N	pdf	pdf_007da5b8ac55efd6	2026-04-29 05:17:12.162511+00	2026-04-29 05:17:12.162511+00	CLP	\N	{}	3	\N	1
\.


--
-- Data for Name: user_tag_rules; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.user_tag_rules (id, user_id, description_key, tags, use_count, last_used_at, custom_description) FROM stdin;
2	1	traspaso a izakaya sushi	{Gustos,Amigos}	1	2026-05-04 05:17:52.289441+00	\N
1	1	traspaso a coniiii	{Agua,Patrimonio}	2	2026-05-04 05:18:08.787441+00	\N
4	1	pago copec app	{Auto,Combustible}	1	2026-05-04 05:18:38.162421+00	\N
5	1	traspaso de goglobal chile spa	{Sueldo}	1	2026-05-04 06:29:44.222322+00	\N
8	1	sebastian prado	{Comida}	1	2026-05-08 02:48:37.149639+00	\N
9	1	mercadopago cassi	{Gustos,Cafe}	1	2026-05-08 03:03:54.886652+00	\N
11	1	goglobal chile spa	{Sueldo}	1	2026-05-08 03:07:24.104171+00	\N
7	1	samuel eugenio andrade	{Casa,Aseo}	4	2026-05-08 03:56:59.68837+00	Aseo casa
14	1	entel pcs pago en	{Personal}	1	2026-05-08 04:36:13.358511+00	Plan celu
17	1	pago automat dividendo hipotecario	{Casa}	1	2026-05-09 00:23:34.607414+00	Dividendo
19	1	cargo seguro accidentes personales	{Personal,Seguros}	1	2026-05-09 23:02:23.159628+00	\N
6	1	coniiii	{Casa}	5	2026-05-09 23:11:06.188272+00	\N
27	1	cargo seguro proteccion bancaria	{Personal,Seguros}	1	2026-05-09 23:15:02.416972+00	\N
33	1	bumblebee baby sp	{Regalo}	1	2026-05-09 23:22:21.337921+00	\N
34	1	pichintun	{Regalo}	1	2026-05-09 23:22:25.259109+00	\N
36	1	belsport s a par	{Coni,Regalo}	2	2026-05-09 23:27:03.099764+00	\N
38	1	mercadopago dulce	{Regalo}	2	2026-05-09 23:27:27.874561+00	La barquillería
42	1	40685 aeropuert	{Transporte}	1	2026-05-09 23:29:26.223451+00	\N
30	1	mercadopago cabif	{Transporte}	2	2026-05-09 23:29:30.005249+00	\N
31	1	la birra chile sp	{Gustos}	2	2026-05-09 23:29:46.90778+00	\N
32	1	mercadopago dunki	{Gustos}	2	2026-05-09 23:29:52.473354+00	\N
35	1	oh bok bunsik spa	{Gustos}	4	2026-05-09 23:30:07.647396+00	\N
47	1	cargo por pago tc	{}	1	2026-05-09 23:30:44.803051+00	TC Nacional
48	1	pago tarjeta de credito	{}	1	2026-05-09 23:30:54.178162+00	TC Internacional
20	1	maldita sea spa	{Gustos}	6	2026-05-09 23:31:54.013756+00	\N
22	1	hotel boutique y	{Gustos}	2	2026-05-09 23:31:57.713222+00	\N
28	1	pago en servipag com	{Casa,Electricidad}	4	2026-05-10 00:22:53.425756+00	Electricidad casa
55	1	meme banco estado	{Personal}	1	2026-05-11 03:30:29.035965+00	Presupuesto personal
18	1	vivero katherine	{Casa}	2	2026-05-17 20:23:03.164041+00	Pago de bugambilia
29	1	unired cl essbio	{Casa,Agua}	2	2026-05-17 23:12:45.23352+00	Agua
\.


--
-- Data for Name: user_tags; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.user_tags (id, user_id, tag, icon, color) FROM stdin;
1	1	Sueldo	\N	\N
43	1	Inversion	\N	\N
55	1	Amigos	\N	\N
8	1	Agua	\N	\N
60	1	Aseo	\N	\N
70	1	Combustible	\N	\N
73	1	Comida	\N	\N
88	1	Regalo	\N	\N
108	1	Electricidad	\N	\N
112	1	Transporte	\N	\N
86	1	Personal	\N	\N
46	1	Gustos	PiggyBank	\N
59	1	Casa	\N	\N
146	1	Coni	\N	\N
158	1	Seguros	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: arasaka-user
--

COPY public.users (id, email, password_hash, created_at, updated_at) FROM stdin;
1	jdelprado@gmail.com	$2a$10$0Q/ZxYmuNGTKbZM7XIcNiezEP705W0NYyS2tCQjro/xnRT/61NS0y	2026-04-26 19:26:18.681732+00	2026-05-08 05:21:32.528223+00
\.


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.accounts_id_seq', 4, true);


--
-- Name: app_tag_rules_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.app_tag_rules_id_seq', 18, true);


--
-- Name: credit_card_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.credit_card_items_id_seq', 140, true);


--
-- Name: credit_card_statements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.credit_card_statements_id_seq', 29, true);


--
-- Name: goose_db_version_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.goose_db_version_id_seq', 31, true);


--
-- Name: tag_budgets_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.tag_budgets_id_seq', 43, true);


--
-- Name: transactions_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.transactions_id_seq', 852, true);


--
-- Name: user_tag_history_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.user_tag_history_id_seq', 57, true);


--
-- Name: user_tags_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.user_tags_id_seq', 166, true);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: arasaka-user
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: app_tag_rules app_tag_rules_pattern_key; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.app_tag_rules
    ADD CONSTRAINT app_tag_rules_pattern_key UNIQUE (pattern);


--
-- Name: app_tag_rules app_tag_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.app_tag_rules
    ADD CONSTRAINT app_tag_rules_pkey PRIMARY KEY (id);


--
-- Name: credit_card_statements cc_statements_dedup; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_statements
    ADD CONSTRAINT cc_statements_dedup UNIQUE (external_account_id, period_from, period_to);


--
-- Name: credit_card_items credit_card_items_bank_raw_id_key; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_items
    ADD CONSTRAINT credit_card_items_bank_raw_id_key UNIQUE (bank_raw_id);


--
-- Name: credit_card_items credit_card_items_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_items
    ADD CONSTRAINT credit_card_items_pkey PRIMARY KEY (id);


--
-- Name: credit_card_statements credit_card_statements_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_statements
    ADD CONSTRAINT credit_card_statements_pkey PRIMARY KEY (id);


--
-- Name: goose_db_version goose_db_version_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.goose_db_version
    ADD CONSTRAINT goose_db_version_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: tag_budgets tag_budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.tag_budgets
    ADD CONSTRAINT tag_budgets_pkey PRIMARY KEY (id);


--
-- Name: tag_budgets tag_budgets_unique; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.tag_budgets
    ADD CONSTRAINT tag_budgets_unique UNIQUE (user_tag_id, year, month);


--
-- Name: transactions transactions_dedup; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_dedup UNIQUE (bank_raw_id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: user_tag_rules user_tag_history_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tag_rules
    ADD CONSTRAINT user_tag_history_pkey PRIMARY KEY (id);


--
-- Name: user_tag_rules user_tag_history_user_id_description_key_key; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tag_rules
    ADD CONSTRAINT user_tag_history_user_id_description_key_key UNIQUE (user_id, description_key);


--
-- Name: user_tags user_tags_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_pkey PRIMARY KEY (id);


--
-- Name: user_tags user_tags_user_id_tag_key; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_user_id_tag_key UNIQUE (user_id, tag);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_user_id; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_accounts_user_id ON public.accounts USING btree (user_id);


--
-- Name: idx_app_tag_rules_pattern; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_app_tag_rules_pattern ON public.app_tag_rules USING btree (pattern);


--
-- Name: idx_transactions_account_date; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_transactions_account_date ON public.transactions USING btree (account_id, date, id);


--
-- Name: idx_transactions_date; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_transactions_date ON public.transactions USING btree (date);


--
-- Name: idx_transactions_flow; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_transactions_flow ON public.transactions USING btree (flow);


--
-- Name: idx_transactions_source_date; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_transactions_source_date ON public.transactions USING btree (source, date, id);


--
-- Name: idx_transactions_tags; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_transactions_tags ON public.transactions USING gin (tags);


--
-- Name: idx_transactions_user_flow_date; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_transactions_user_flow_date ON public.transactions USING btree (user_id, flow, date);


--
-- Name: idx_user_tag_rules_user_key; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_user_tag_rules_user_key ON public.user_tag_rules USING btree (user_id, description_key);


--
-- Name: idx_user_tags_user_id; Type: INDEX; Schema: public; Owner: arasaka-user
--

CREATE INDEX idx_user_tags_user_id ON public.user_tags USING btree (user_id);


--
-- Name: accounts accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: credit_card_items credit_card_items_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_items
    ADD CONSTRAINT credit_card_items_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: credit_card_items credit_card_items_statement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_items
    ADD CONSTRAINT credit_card_items_statement_id_fkey FOREIGN KEY (statement_id) REFERENCES public.credit_card_statements(id);


--
-- Name: credit_card_items credit_card_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_items
    ADD CONSTRAINT credit_card_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: credit_card_statements credit_card_statements_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_statements
    ADD CONSTRAINT credit_card_statements_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: credit_card_statements credit_card_statements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.credit_card_statements
    ADD CONSTRAINT credit_card_statements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: tag_budgets fk_tag_budgets_user_tag; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.tag_budgets
    ADD CONSTRAINT fk_tag_budgets_user_tag FOREIGN KEY (user_tag_id) REFERENCES public.user_tags(id) ON DELETE CASCADE;


--
-- Name: transactions fk_transactions_cc_statement; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT fk_transactions_cc_statement FOREIGN KEY (cc_statement_id) REFERENCES public.credit_card_statements(id);


--
-- Name: tag_budgets tag_budgets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.tag_budgets
    ADD CONSTRAINT tag_budgets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: transactions transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_tag_rules user_tag_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tag_rules
    ADD CONSTRAINT user_tag_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_tags user_tags_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: arasaka-user
--

ALTER TABLE ONLY public.user_tags
    ADD CONSTRAINT user_tags_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict OcPPU2bQfHMdaMGwagXQyxcrrlHPTjsR3JCn5tBQ9PK38Rasu79bNkVkZ5n08SO

