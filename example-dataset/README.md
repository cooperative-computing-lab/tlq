# TLQ Example with Lifemapper Dataset
You can runy queries with this precreated dataset from a run of the Lifemapper scientific workflow. None of the execution data has been retained, only the debug logs and parsed JSON metalogs.

## Configuring the dataset
Before running TLQ, you need to properly configure the dataset. This involves altering the URLs in the client-side and server-side list of logs. This is done by running:
```
sh configure-logs
```

## Running a TLQ log server
To properly run queries, you need to have a log server running to serve a client. To run a log server with the provided dataset, run:
```
cd ../server && perl tlq-server -p 11855 -d /path/to/server-data
```

## Running a TLQ client
In a separate terminal on the same machine, start up the querying client:
```
cd ../client && perl tlq-client -s
```

From here, you can now execute queries with TLQ. Run the `list` command in the client to see the list of available logs to query and their URLs.
The `jx` command will drop you into an interactive shell for querying the JSON metalogs.
The `query` command allows you to execute arbitrary tools at the server, such as `grep`.
