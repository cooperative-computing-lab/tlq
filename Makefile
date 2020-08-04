CCTOOLS = cctools
LIFEMAPPER = lifemapper/trace.debug
PERLBASE = .perl5
PERLS = .perl_modules_installed
SHAKESPEARE = shakespeare/trace.debug
SOURCE = cctools_source

$(SOURCE): /usr/bin/git
	@echo Installing CCTools software repository in working directory.
	git clone git@github.com:cooperative-computing-lab/cctools.git $(SOURCE) || git clone https://github.com/cooperative-computing-lab/cctools.git $(SOURCE)
	
$(CCTOOLS): $(SOURCE)
	mkdir $(CCTOOLS) || true
	cd $(SOURCE) && ./configure --strict --prefix ../$(CCTOOLS) --tcp-low-port 9000 --tcp-high-port 9500 && make install
	cp $(SOURCE)/dttools/src/jx_test ./client/

$(LIFEMAPPER): $(CCTOOLS) $(PERLBASE)
	cd lifemapper && make all

$(PERLBASE): $(PERLS)
	@echo Copying local perl5 installation to working directory.
	mkdir .perl5
	mkdir .perl5/lib
	cp -r ~/.perl5/lib/perl5 .perl5/lib/
	cp -r ~/.perl5/bin .perl5/

$(PERLS):
	@echo Downloading and installing required Perl modules.
	curl -L https://cpanmin.us | perl - App::cpanminus >> $(PERLS) 2>&1
	cpan install Compress::Zlib || true >> $(PERLS) 2>&1
	cpan install Data::Dumper || true >> $(PERLS) 2>&1
	cpan install DateTime || true >> $(PERLS) 2>&1
	cpan install Error || true >> $(PERLS) 2>&1
	cpan install Error::Simple || true >> $(PERLS) 2>&1
	cpan install Getopt::Long || true >> $(PERLS) 2>&1
	cpan install HTTP::Server::Simple::CGI || true >> $(PERLS) 2>&1
	cpan install IO::Socket::INET || true >> $(PERLS) 2>&1
	cpan install JSON || true >> $(PERLS) 2>&1
	cpan install LWP::UserAgent || true >> $(PERLS) 2>&1
	cpan install Sys::Hostname || true >> $(PERLS) 2>&1
	cpan install Term::ReadLine || true >> $(PERLS) 2>&1
	cpan install Term::ReadLine::Gnu || true >> $(PERLS) 2>&1
	cpan install Time::HiRes || true >> $(PERLS) 2>&1
	cpan install URI::Encode || true >> $(PERLS) 2>&1

$(SHAKESPEARE): $(CCTOOLS) $(PERLBASE)
	cd shakespeare && make all

all: $(CCTOOLS) $(LIFEMAPPER) $(PERLBASE) $(PERLS) $(SHAKESPEARE) $(SOURCE)

build: $(CCTOOLS) $(PERLBASE) $(PERLS) $(SOURCE)

lifemapper: $(LIFEMAPPER)

shakespeare: $(SHAKESPEARE)

clean:
	@echo Cleaning TLQ installation.
	cd lifemapper && make clean
	cd shakespeare && make clean
	cd client && rm -rf .tlq_session.log deposits.log jx_test
	rm -rf $(CCTOOLS) $(PERLBASE) $(PERLS) $(SOURCE)

.PHONY: all clean

# vim: set noexpandtab tabstop=4:
