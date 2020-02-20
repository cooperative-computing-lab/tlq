CCTOOLS = ../cctools
DATA = data
FAILED = makeflow.failed.*
GENERATOR = split.py
LIFEMAPPER = makeflow-examples/lifemapper
LOGCOLLECT = logs/disc20 logs/disc21 logs/disc22 logs/disc23 logs/disc24 logs/disc25 logs/disc26 logs/student10
LOGS = *.wqlog *.debug *.trace
LTRACE = ltrace-wrapper-lifemapper
LOGDEF = log-define
MAKEFLOW = $(NOTRACEMAKE) $(TRACEMAKE)
NOTRACE = notrace.debug
NOTRACEMAKE = notrace.jx
OUTPUTS = outputs
PERL = test
POINTS = points
SOURCE = ../cctools-source
TIME = logs/time.dat
TOOLS = tools
TRACE = trace.debug
TRACEMAKE = trace.jx
WORKERS = workers/cctools_gpu_autodetect workers/log-define workers/work_queue_worker workers/worker.*.error workers/worker.*.output workers/workers.log

CLEANUP = $(DATA) $(FAILED) $(GENERATOR) $(LOGCOLLECT) $(LOGS) $(LOGDEF) $(NOTRACE) $(OUTPUTS) $(POINTS) $(TOOLS) $(TRACE) $(WORKERS)

$(CCTOOLS): /usr/bin/git
	git clone git@github.com:cooperative-computing-lab/cctools.git $(SOURCE) || git clone https://github.com/cooperative-computing-lab/cctools.git $(SOURCE)
	mkdir $(CCTOOLS) || true
	cd $(SOURCE) && ./configure --strict --prefix $(CCTOOLS) --tcp-low-port 9000 --tcp-high-port 9500 && make install

$(GENERATOR): $(CCTOOLS)
	git clone git@github.com:cooperative-computing-lab/makeflow-examples.git || git clone https://github.com/cooperative-computing-lab/makeflow-examples.git
	mv $(LIFEMAPPER)/data $(LIFEMAPPER)/tools $(LIFEMAPPER)/$(GENERATOR) .
	rm -rf makeflow-examples

$(LOGCOLLECT): $(TRACE)
	cd logs && sh pull-data

$(LOGDEF):
	cp ../$(LOGDEF) .

$(NOTRACE): $(LOGDEF) $(LTRACE) $(NOTRACEMAKE) $(POINTS)
	../cctools/bin/condor_submit_workers -N wq-trace -r "MachineGroup == \"DISC\" && (MachineShortName == \"disc17\" || MachineShortName == \"disc18\" || MachineShortName == \"disc19\" || MachineShortName == \"disc20\" || MachineShortName == \"disc21\" || MachineShortName == \"disc22\" || MachineShortName == \"disc23\" || MachineShortName == \"disc24\" || MachineShortName == \"disc25\" || MachineShortName == \"disc26\")" -E "-d all -o worker.debug --debug-rotate-max 0 -t 3600" 15
	cd workers && condor_submit workers.submit
	perl test --name wq-trace --mode 1

$(POINTS): $(CCTOOLS) $(GENERATOR)
	python $(GENERATOR) data/points/large.csv

$(TRACE): $(LOGDEF) $(LTRACE) $(POINTS) $(TRACEMAKE) $(WORKERS)
	cd workers && condor_submit workers.submit
	makeflow -T wq -N wq-trace --jx trace.jx

$(WORKERS): $(CCTOOLS)
	cp ../cctools/bin/cctools_gpu_autodetect ./workers/
	cp ../cctools/bin/work_queue_worker ./workers
	cp ../log-define ./workers

all: $(CCTOOLS) $(NOTRACE) $(TRACE)

build: $(GENERATOR) $(LOGDEF) $(POINTS)

clean:
	../cctools/bin/makeflow -c --jx $(NOTRACEMAKE) || true
	../cctools/bin/makeflow -c --jx $(TRACEMAKE) || true
	rm -rf $(CLEANUP)
	condor_rm $(USER)

lean:
	../cctools/bin/makeflow -c --jx $(NOTRACEMAKE) || true
	../cctools/bin/makeflow -c --jx $(TRACEMAKE) || true
	condor_rm $(USER)

trace: $(TRACE)

.PHONY: all clean

# vim: set noexpandtab tabstop=4:
