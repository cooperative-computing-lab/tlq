ANALYZE = text_analyzer.pl
CCTOOLS = ../cctools
COUNT = count_characters.pl
FAILED = makeflow.failed.*
LOGS = *.makeflowlog *.wqlog *.debug *.trace
LTRACE = ltrace_wrapper
LOGDEF = log_define
MFDIR = makeflow_examples
PERLS = $(ANALYZE) $(COUNT)
SHAKESPEARE = makeflow_examples/shakespeare
SOURCE = ../cctools_source
TEXTS = *.txt
TLQDIR = /disk/d11/tlq
TRACE = trace.debug
TRACEMAKE = trace.jx
WORKERS = workers/cctools_gpu_autodetect workers/log_define workers/work_queue_worker workers/worker.*.error workers/worker.*.output workers/workers.log

CLEANUP = $(FAILED) $(LOGS) $(LOGDEF) $(LTRACE) $(PERLS) $(TEXT) $(TRACE) $(WORKERS)

$(CCTOOLS): /usr/bin/git
	git clone git@github.com:cooperative-computing-lab/cctools.git $(SOURCE) || git clone https://github.com/cooperative-computing-lab/cctools.git $(SOURCE)
	mkdir $(CCTOOLS) || true
	cd $(SOURCE) && ./configure --strict --prefix $(CCTOOLS) --tcp-low-port 9000 --tcp-high-port 9500 && make install

$(ANALYZE): $(CCTOOLS)
	git clone git@github.com:cooperative-computing-lab/makeflow-examples.git $(MFDIR) || git clone https://github.com/cooperative-computing-lab/makeflow-examples.git $(MFDIR)
	mv $(SHAKESPEARE)/$(COUNT) $(SHAKESPEARE)/$(ANALYZE) .
	rm -rf makeflow_examples

$(LOGDEF):
	cp ../$(LOGDEF) .

$(LTRACE):
	cp ../$(LTRACE) .

$(TRACE): $(LOGDEF) $(LTRACE) $(PERLS) $(TRACEMAKE) $(WORKERS)
	cd workers && condor_submit workers.submit
	sh $(LOGDEF) disc01.crc.nd.edu 9001 $(TLQDIR) ${PWD}/trace.debug makeflow_and_work_queue_master -- makeflow -T wq -N wq-trace -d all -o ${PWD}/trace.debug --jx trace.jx

$(WORKERS): $(CCTOOLS)
	cp ../cctools/bin/cctools_gpu_autodetect ./workers/
	cp ../cctools/bin/work_queue_worker ./workers
	cp ../log_define ./workers

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
