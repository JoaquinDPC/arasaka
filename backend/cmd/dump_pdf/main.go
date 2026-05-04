// dump_pdf prints all text extracted from a PDF grouped by page and Y row.
// Usage: go run ./cmd/dump_pdf <file.pdf>
package main

import (
	"bytes"
	"fmt"
	"math"
	"os"
	"sort"

	"rsc.io/pdf"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: dump_pdf <file.pdf>")
		os.Exit(1)
	}

	data, err := os.ReadFile(os.Args[1])
	if err != nil {
		fmt.Fprintf(os.Stderr, "read: %v\n", err)
		os.Exit(1)
	}

	r, err := pdf.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		fmt.Fprintf(os.Stderr, "open pdf: %v\n", err)
		os.Exit(1)
	}

	for p := 1; p <= r.NumPage(); p++ {
		fmt.Printf("\n=== PAGE %d ===\n", p)
		page := r.Page(p)
		content := page.Content()

		type el struct{ x, y float64; s string }
		var elems []el
		for _, t := range content.Text {
			elems = append(elems, el{t.X, t.Y, t.S})
		}

		// group by Y with tolerance 3
		type group struct{ y float64; els []el }
		var groups []group
		for _, e := range elems {
			placed := false
			for i := range groups {
				if math.Abs(groups[i].y-e.y) < 3 {
					groups[i].els = append(groups[i].els, e)
					placed = true
					break
				}
			}
			if !placed {
				groups = append(groups, group{y: e.y, els: []el{e}})
			}
		}
		sort.Slice(groups, func(i, j int) bool { return groups[i].y > groups[j].y })
		for _, g := range groups {
			sort.Slice(g.els, func(a, b int) bool { return g.els[a].x < g.els[b].x })
			fmt.Printf("  Y=%.1f | ", g.y)
			for _, e := range g.els {
				fmt.Printf("[%s] ", e.s)
			}
			fmt.Println()
		}
	}
}
