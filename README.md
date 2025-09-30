This tool allows to execute various operations on uuCloud using CLI.

# How to install and update ?

## Linux and MacOS
### Stable
`MONGOMS_DISABLE_POSTINSTALL=1 npx uu-safe-install install --registry "https://repo.plus4u.net/repository/npm/" -g uucloud-cli`
### Beta
`MONGOMS_DISABLE_POSTINSTALL=1 npx uu-safe-install install --registry "https://repo.plus4u.net/repository/npm/" -g uucloud-cli@beta`

## Windows
### Stable
`npx uu-safe-install install --registry "https://repo.plus4u.net/repository/npm/" -g uucloud-cli`
### Beta 
`npx uu-safe-install install --registry "https://repo.plus4u.net/repository/npm/" -g uucloud-cli@beta`

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

# How to use presets ?

Presets allows set default values for named preset.   

Example of usage from config.json:
```json
{
  "...": "any aother configuration",
  "presents": {
    "libra-int-west": {
      "resource-pool": "ues:DEV0149-BT[84753967820114986]:AWE_USYE.LIBRAM[5cdacf12b338bf708e1b7645]"
    },
    "cams-dev": {
      "resource-pool": "ues:UNI-BT:DEV",
      "authentication-type": "basic",
      "authentication": "vault",
      "user": "camsDevCloudAdmin",
      "c3-uri": "http://mongoa.cams:8080",
      "log-store-uri": "http://apps.cams/usy-logstore-elkbackendg01/79900000000000000000000000000000"
    }
  },
  "...": "any aother configuration"
}

```

# How to use shortcuts ?

Shortcuts allow to replace whole command or part of the command by shortcut commands. 

Example of usage from config.json:
```json
{
  "...": "any aother configuration",
  "shortcuts": [
    {
      "shortcut": "p",
      "command": "ps"
    },
    {
      "shortcut": "l",
      "command": "logs"
    },    
    {
      "shortcut": "pp",
      "command": "ps -p cams-prs"
    },    
    {
      "shortcut": "lt",
      "command": "logs -p cams-test -f"
    }
  ],
  "...": "any other configuration"
}

```

# Command Line Option Format

The CLI supports two formats for command line options:

1. Kebab-case format (preferred): Use hyphens between words, e.g., `--resource-pool`, `--command-path`, `--log-store-uri`, `--time-window-type`
2. CamelCase format (for backward compatibility): Words concatenated with capitalization, e.g., `--resourcePool`, `--commandPath`, `--logStoreUri`, `--timeWindowType`

Both formats are accepted on the command line, so these commands are equivalent:
```
uucloud logs --time-window-type timeStamp
uucloud logs --timeWindowType timeStamp
```

The kebab-case format is the preferred standard and is used in all documentation and examples. Internally, the CLI converts all option names to camelCase when processing them.

# Release Notes

1.0.0
-----
- **Interactive Preset Selection**: Added `--select-preset` (`-s`) flag to `uucloud i` command for choosing configured environment presets

1.0.0-beta.16
-------------
- **Business Territory Resource Pool Support**
  - **Unified Parameter**: Use existing `--resource-pool` / `-r` parameter for both resource pools and business territories
  - **PS Command**: List applications from business territories using business territory URIs with resource-pool parameter
  - **Logs Command**: Retrieve and follow logs from applications in business territories. Logstore uri is retrieved for each plugged application automatically. 
  - **Interactive Mode**: Select applications from both business territory resource pool type and resource pools in interactive mode
  - **Configuration**:
  - ```
    {
      "presents": {
        "present-env": {
			"universe-uri": "...",
			"resourcePool": [
				"6810827f5f8702c461c5b8f8", // resource pool oid in the universe 
				"https://uuapp-dev.plus4u.net/uu-businessterritory-maing01/3672205402d0bc3e26fe89b7727b1f07" // base business territory uri to load the application pligged into the business territory
			],
			"log-store-uri": "https://uuapp.plus4u.net/uu-cloudlogstore-maing02/5414770bf91642db994180d440d0575f"
		}
      }
    }
    ```
- Bugfix: correctly cache token
1.0.0-beta.15
-------------
- Add `--allow-multi-app` option to logs command for downloading logs from multiple applications without `--follow`
  - Logs from all specified applications are collected and sorted chronologically by eventTime
  - Works with all output codecs including gantt (gantt uses first app's configuration for additional data fetching)

1.0.0-beta.14
-------------

- **Gantt Codec Support**
  - it is activated by `--codec=gantt`
  - it is only possible to list logs for single subapp with gantt view
  - it is not possible to use `--follow` option with gantt codec
  - it must be used together with `logs -c recordType:ACCESS_LOG` option
  - to get perfmon records, it is necessary to
    - have configured uri to uuAppLogStore in subapp configuration
    - have enabled shipping of audit logs from subapp to uuApplogstore
    - have configured indexes and filtering based on `logTypeCode` and `requestId` - see https://uuapp.plus4u.net/uu-bookkit-maing01/926da88d2adb4449b69d3a57b81f189e/book/page?code=32134022
  - it is possible to use it with combination of filtering:
    - examples: `--filter "not ( urlPath ~= \"sys/getHealth\")"` to filter out sys/getHealth
  - example: `uuclou logs -c recordType:ACCESS_LOG -p smarta-dev1 uu-griffin-entity --since "2025-05-28T09:00:00.108Z" --until "2025-05-28T09:04:59.108Z" --filter "not ( urlPath ~= \"sys/getHealth\")" --codec=gantt`

1.0.0-beta.13
-------------
- Bugfix: do not fail when application code is null (some invalid state in universe) 

1.0.0-beta.12
-------------
- Bugfix: do not fail when shortcut command is using chalk templates eg. `{{code}}`

1.0.0-beta.11
-------------
- add support for kebab-case command line options (e.g., `--resource-pool` in addition to `--resourcePool`)
- standardize documentation to use kebab-case option format

1.0.0-beta.9
------------
- fix behavior of `--insecure` to sef config parameter `uu_app_client_verify_ssl`

1.0.0-beta.5
------------
- add `--version` and `--release-notes` (or `--releaseNotes`) commands

1.0.0-beta.4
------------
- upgrade to appserver 6.x

1.0.0-beta.2
------------
- add back documentation to logs command help
- support tags for uucloudg02

1.0.0-beta.1
------------
- add intreactive mode

0.18.0
------
- add full support for uuCloudg02 in `ps` and `logs` commands. 
  - you can specify `universe-uri` and resource pool oid instead of resource pool UESURI
  - you can filter applications by their code (in addition to uri,  ASID and tags) 

0.16.3
------
- bugfix: uuClougLogStoreg02 - fixed scope while using custom oidc with vault strategy

  0.16.2
------
- bugfix: uuClougLogStoreg02 - fixed using custom oidc 

0.16.1
------
- bugfix: uuClougLogStoreg02 - fixed obtaining logs from defined interval to list more that first page
 
0.16.0
------
- add support for uuClougLogStoreg02
- add minimal support for logs in uuCloudg02

0.15.0
------
- add support for logs download recovery (--recover flag)

0.14.1
------
- extend ps & commands
  - support for using multiple resource pools
- add state to ps

0.13.1
------
- bugfix: ensure uuUri query param is encoded

0.13.0
------
- add support for shortcuts

0.12.2
------
- bugfix: ensure that colors in version 1.4.0 is used (https://www.bleepingcomputer.com/news/security/dev-corrupts-npm-libs-colors-and-faker-breaking-thousands-of-apps/)

0.12.1
------
- bugfix: support / in resource pool uri

0.12.0
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

