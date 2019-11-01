/*
General Data Types:
  Component
  Process
  File
  EnvVar

Custom Data Types:
  Workflow
  Master
  Worker
*/

module.exports = `
  type Query {
    components(system:String!, log:String, host:String, command:String, exitStatus:String): [Component]
    envVars(system:String!, log:String, host:String, name:String, results:String) : [EnvVar]
    files(system:String!, log:String, host:String, path:String, failures:String): [File]
    processes(system:String!, log:String, host:String, pid:Int, ppid:Int): [Process]
  }

  type Component {
    id: ID
    hash: String
    command: String
    exitStatus: String
    host: String
    log: String
    process: Process
  }

  type Process {
    id: ID
    hash: String
    pid: Int
    ppid: Int
    host: String
    log: String
    system: String
    component: Component
    envVar: EnvVar
    file: File
    process: Process
  }

  type File {
    id: ID
    hash: String
    path: String
    failures: Int
    host: String
    log: String
    system: String
    component: Component
    process: Process
  }
  
  type EnvVar {
    id: ID
    hash: String
    name: String
    results: String
    host: String
    log: String
    system: String
    component: Component
    process: Process
  }
`

// vim: tabstop=4 shiftwidth=2 softtabstop=2 expandtab shiftround autoindent
