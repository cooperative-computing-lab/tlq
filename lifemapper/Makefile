CCTOOLS = ../cctools
DATA = data
FAILED = makeflow.failed.*
GENERATOR = split.py
LIFEMAPPER = makeflow-examples/lifemapper
LOGCOLLECT = logs/disc20 logs/disc21 logs/disc22 logs/disc23 logs/disc24 logs/disc25 logs/disc26 logs/student10
LOGS = *.wqlog *.debug *.trace
LTRACE = ltrace-wrapper
LOGDEF = log-define
MAKEFLOW = $(TRACEMAKE)
OUTPUTS = outputs
PERL = test
POINTS = points
SOURCE = ../cctools-source
TIME = logs/time.dat
TLQDIR = /disk/d11/tlq
TOOLS = tools
TRACE = trace.debug
TRACEMAKE = trace.jx
WORKERS = workers/cctools_gpu_autodetect workers/log-define workers/work_queue_worker workers/worker.*.error workers/worker.*.output workers/workers.log

CLEANUP = $(DATA) $(FAILED) $(GENERATOR) $(LOGCOLLECT) $(LOGS) $(LOGDEF) $(OUTPUTS) $(POINTS) $(TOOLS) $(TRACE) $(WORKERS)

$(CCTOOLS): /usr/bin/git
	git clone git@github.com:cooperative-computing-lab/cctools.git $(SOURCE) || git clone https://github.com/cooperative-computing-lab/cctools.git $(SOURCE)
	mkdir $(CCTOOLS) || true
	cd $(SOURCE) && ./configure --strict --prefix $(CCTOOLS) --tcp-low-port 9000 --tcp-high-port 9500 && make install

$(GENERATOR): $(CCTOOLS)
	git clone git@github.com:cooperative-computing-lab/makeflow-examples.git || git clone https://github.com/cooperative-computing-lab/makeflow-examples.git
	mv $(LIFEMAPPER)/data $(LIFEMAPPER)/tools $(LIFEMAPPER)/$(GENERATOR) .
	rm -rf makeflow-examples

$(LOGCOLLECT): $(TRACE)
	cd logs && sh pull-data $(TLQDIR)

$(LOGDEF):
	cp ../$(LOGDEF) .

$(LTRACE):
	cp ../$(LTRACE) .

$(POINTS): $(CCTOOLS) $(GENERATOR)
	python $(GENERATOR) data/points/large.csv

$(TRACE): $(LOGDEF) $(LTRACE) $(POINTS) $(TRACEMAKE) $(WORKERS)
	cd workers && condor_submit workers.submit
	$(LOGDEF) disc01.crc.nd.edu 9001 ${PWD}/trace.debug makeflow-and-work-queue -- makeflow -T wq -N wq-trace -d all -o ${PWD}/trace.debug --jx trace.jx

$(WORKERS): $(CCTOOLS)
	cp ../cctools/bin/cctools_gpu_autodetect ./workers/
	cp ../cctools/bin/work_queue_worker ./workers
	cp ../log-define ./workers

all: $(CCTOOLS) $(TRACE)

build: $(GENERATOR) $(LOGDEF) $(POINTS)

clean:
	../cctools/bin/makeflow -c --jx $(TRACEMAKE) || true
	rm -rf $(CLEANUP)
	condor_rm $(USER)

lean:
	../cctools/bin/makeflow -c --jx $(TRACEMAKE) || true
	condor_rm $(USER)

trace: $(TRACE)

.PHONY: all clean

# vim: set noexpandtab tabstop=4:
