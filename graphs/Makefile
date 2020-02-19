NODE = node-model.dat
QUERY = query-model.dat
PDF1 = node-model.pdf
PDF2 = query-model.pdf

DATA = $(NODE) $(QUERY)
PDFS = $(PDF1) $(PDF2)

CLEANUP = $(DATA) $(PDFS)

$(NODE): /usr/bin/perl
	perl model-node > $(NODE)

$(QUERY): /usr/bin/perl
	perl model-query > $(QUERY)

$(PDF1): /usr/bin/gnuplot
	gnuplot plot-node-model.plg > $(PDF1)

$(PDF2): /usr/bin/gnuplot
	gnuplot plot-query-model.plg > $(PDF2)

all: $(DATA) $(PDFS)

clean:
	rm -rf $(CLEANUP)

lean:
	rm -rf $(PDFS)


.PHONY: all clean lean

# vim: set noexpandtab tabstop=4:
