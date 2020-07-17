ANALYZE = text_analyzer.pl
CCTOOLS = ../cctools
COUNT = count_characters.pl
FAILED = makeflow.failed.*
SHAKESPEARE = makeflow-examples/shakespeare
LOGS = *.makeflowlog *.wqlog *.debug *.trace
LTRACE = ltrace-wrapper
LOGDEF = log-define
PERLS = $(ANALYZE) $(COUNT)
SOURCE = ../cctools-source
TRACE = trace.debug
TRACEMAKE = trace.jx
WORKERS = workers/cctools_gpu_autodetect workers/log-define workers/work_queue_worker workers/worker.*.error workers/worker.*.output workers/workers.log

CLEANUP = $(FAILED) $(LOGS) $(LOGDEF) $(LTRACE) $(PERLS) $(TRACE) $(WORKERS)

$(CCTOOLS): /usr/bin/git
	git clone git@github.com:cooperative-computing-lab/cctools.git $(SOURCE) || git clone https://github.com/cooperative-computing-lab/cctools.git $(SOURCE)
	mkdir $(CCTOOLS) || true
	cd $(SOURCE) && ./configure --strict --prefix $(CCTOOLS) --tcp-low-port 9000 --tcp-high-port 9500 && make install

$(ANALYZE): $(CCTOOLS)
	git clone git@github.com:cooperative-computing-lab/makeflow-examples.git || git clone https://github.com/cooperative-computing-lab/makeflow-examples.git
	mv $(SHAKESPEARE)/$(COUNT) $(SHAKESPEARE)/$(ANALYZE) .
	rm -rf makeflow-examples

$(LOGDEF):
	cp ../$(LOGDEF) .

$(LTRACE):
	cp ../$(LTRACE) .

$(TRACE): $(LOGDEF) $(LTRACE) $(PERLS) $(TRACEMAKE) $(WORKERS)
	cd workers && condor_submit workers.submit
	$(LOGDEF) disc01.crc.nd.edu 9001 ${PWD}/trace.debug makeflow-and-work-queue makeflow -T wq -N wq-trace -d all -o ${PWD}/trace.debug --jx trace.jx

$(WORKERS): $(CCTOOLS)
	cp ../cctools/bin/cctools_gpu_autodetect ./workers/
	cp ../cctools/bin/work_queue_worker ./workers
	cp ../log-define ./workers

all: $(CCTOOLS) $(ANALYZE) $(TRACE)

build: $(ANALYZE) $(LOGDEF) $(LTRACE)

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
