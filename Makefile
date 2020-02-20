CCTOOLS = cctools
CONDORPOVRAY = condor-povray/condor.debug
LIFEMAPPER = lifemapper/ltrace.debug
PERLBASE = .perl5
PERLS = .perl-modules-installed
SHAREDFS = testing/shared-fs/master.debug
SOURCE = cctools-source

$(SOURCE): /usr/bin/git
	git clone git@github.com:cooperative-computing-lab/cctools.git $(SOURCE) || git clone https://github.com/cooperative-computing-lab/cctools.git $(SOURCE)
	
$(CCTOOLS): $(SOURCE)
	mkdir $(CCTOOLS) || true
	cd $(SOURCE) && ./configure --strict --prefix ../$(CCTOOLS) --tcp-low-port 9000 --tcp-high-port 9500 && make install

$(CONDORPOVRAY): $(CCTOOLS) $(PERLBASE)
	cd condor-povray && make

$(LIFEMAPPER): $(CCTOOLS) $(PERLBASE)
	cd lifemapper && make

$(PERLBASE): $(PERLS)
	mkdir .perl5
	mkdir .perl5/lib
	cp -r ~/.perl5/lib/perl5 .perl5/lib/
	cp -r ~/.perl5/bin .perl5/

$(PERLS):
	curl -L https://cpanmin.us | perl - App::cpanminus >> $(PERLS) 2>&1
	cpan install Error || true >> $(PERLS) 2>&1
	cpan install DateTime || true >> $(PERLS) 2>&1
	cpan install Error::Simple || true >> $(PERLS) 2>&1
	cpan install Getopt::Long || true >> $(PERLS) 2>&1
	cpan install IO::Socket::PortState || true >> $(PERLS) 2>&1
	cpan install LWP::UserAgent || true >> $(PERLS) 2>&1
	cpan install Term::ReadLine || true >> $(PERLS) 2>&1
	cpan install Term::ReadLine::Gnu || true >> $(PERLS) 2>&1
	cpan install Sys::Hostname || true >> $(PERLS) 2>&1
	cpan install HTTP::Server::Simple::CGI || true >> $(PERLS) 2>&1
	cpan install Digest::MD5 || true >> $(PERLS) 2>&1
	cpan install File::Basename || true >> $(PERLS) 2>&1
	cpan install Data::Dumper || true >> $(PERLS) 2>&1
	cpan install JSON || true >> $(PERLS) 2>&1
	cpan install Thread::Semaphore || true >> $(PERLS) 2>&1
	cpan install URI::Encode || true >> $(PERLS) 2>&1
	cpan install Time::HiRes || true >> $(PERLS) 2>&1

$(SHAREDFS):
	cd testing/shared-fs && make

all: $(CCTOOLS) $(CONDORPOVRAY) $(LIFEMAPPER) $(PERLBASE) $(PERLS) $(SOURCE)

clean:
	cd condor-povray && make clean
	cd lifemapper && make clean
	rm -rf $(CCTOOLS) $(PERLBASE) $(SOURCE)

.PHONY: all clean

# vim: set noexpandtab tabstop=4:
