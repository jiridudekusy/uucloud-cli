This tool allows to execute various operations on uuCloud using CLI.

# How to install and update ?

## Linux and MacOS
### Stable
`npm install --registry "https://repo.plus4u.net/repository/npm/" -g $(npm v --registry https://registry.npmjs.com uucloud-cli dist.tarball)`
### Beta
`npm install --registry "https://repo.plus4u.net/repository/npm/" -g $(npm v --registry https://registry.npmjs.com uucloud-cli@beta dist.tarball)`

## Windows
### Stable
1. `npm v --registry https://registry.npmjs.com uucloud-cli dist.tarball`
2. `npm install --registry "https://repo.plus4u.net/repository/npm/" -g {archive url from previous command}`
### Beta 
1. `npm v --registry https://registry.npmjs.com uucloud-cli@beta dist.tarball`
2. `npm install --registry "https://repo.plus4u.net/repository/npm/" -g {archive url from previous command}`

# How to use ?

- `uucloud --help`
- `uucloud use --help`
- `uucloud ps --help`
- `uucloud logs --help`

# How to use not default uuCloud ?

If you have dedicated deployment of uuCloud you must use different uri to access deployment list and logs.

Current version of uucloud-cli supports only specification of different uri for logs via option `log-store-uri` (see help for more information). 
For example:

`uucloud logs -a browser --log-store-uri="https://libra-sys-ei.plus4u.net/uu-logstore/" -n "ues:DTC-BT[99923616732520257]:LIBRA_DATAFLOW[5c5d4bdce1ada19aba86fdbd]:USY.LIBRAG01.CONFIGURATION[5c5d4efde1ada1405d86fe42]"`

# How to use presents ? 

   
# Release Notes
0.12.0-beta.0
-------------
- extend logs command:
    - add `jsonstream` codec
    - add `criteria` option to support server side filtering
    - add `timeWindowType` option to support paging by different time attribute(`tmestamp` is default)
- all non-results texts (such as promp messages or information messages) are now printed to stderr instead of stdout. Only result is printed to stdout and it allows to forexample pipe result of logs command with `jsonstream` codec directly to `jq` tool



0.11.0
------
- add support for on-premise uucloud
- add option `authenticationType` to support http basic auth
- add authentication option `passwordFile` and option `passwordFile` to support authrntication usin g password in same way as uuDevKitg01

0.10.2
------
- use provided access codes for token refresh

0.10.0
------
- use uuOidcg02

0.9.0
-----
- add support for filtering of apps on `ps` task when using `raw` codec


0.8.0
-----
- add support for filtering of apps on `ps` task

0.7.3
-----
- ps task:
    - display correctly count (including spp)
    - add allocated cpu and memory
    - add total 


0.7.2
-----
- Increase logs fetch retry count to 10 and logging of retries 

0.7.1
-----
- Bugfix: Show stacktrace in default output format. (fixed typo)  

0.7.0
-----
- add version to **ps** command.


0.6.0
-----
- Add automatic checking for new versions.
- Add `codec` parameter to **ps** command.
- Add `codec` parameter to **logs** command.
- Add filtering using `filter` parameter to **logs** command.
- Add custom formatting using `format` parameter to **logs** command.


# How to develop ?

Publish stable to npmjs: 

`npm publish --registry https://registry.npmjs.com`

Publish beta to npmjs: 

`npm publish --registry https://registry.npmjs.com --tag beta`
