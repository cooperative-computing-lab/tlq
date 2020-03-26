LOG = rubiks1920.log
MOVIE = rubiks1920.mpg
POVRAY = condor-povray
RUBIKS = WRC-RubiksCube.inc

all: $(MOVIE)

$(MOVIE): $(POVRAY) rubiks1920.pov $(RUBIKS)
	perl $(POVRAY) rubiks1920.pov rubiks1920.mpg 3 1920 1080 /disk/d11/tlq

1080p: $(MOVIE)

clean:
	condor_rm nkremerh || true
	rm -rf $(LOG) $(MOVIE) *.mpg *.debug *.error *.png *.log *.out *.submit || true
