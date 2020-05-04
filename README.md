# harhar

A CLI tool to record, replay, manipulate and analyze HTTP archive files.

Some usages are:

* Reproduce HTTP traffic as recorded by a browser
* Record non-browser traffic
* Mock HTTP server based on recorded traffic
* Compare HTTP traffic of different systems

## Installation

```sh
npm install -g harhar
```

## Usage

```sh
harhar --help
```

## Development

Install required dependencies using:

```sh
npm install
```

Use the following to make the current directory be used as the `harhar` command:

```sh
npm link
```

## Commands

harhar supports the following commands:

### `proxy`

```text
Usage: harhar proxy [options]

Record traffic between a HTTP client and server. This passes incoming requests towards a host and passes the resulting response back to the client.
This records incoming requests and outgoing responses.

Options:
  --listen-port <port>   
  --listen-host <host>   
  --connect-host <host>  
  --connect-port <port>  
  --record <har_file>    
```

### `clientreplay`

```text
Usage: harhar clientreplay [options]

Replays the requests of a HAR file. The responses that were sent back can optionally be recorded to a new HAR file.

Options:
  --input <har_file>                 
  --record <har_file>                
  --replace-hostname <new_hostname>  
  --replace-port <new_port>          
```

### `serverreplay`

```text
Usage: harhar serverreplay [options]

Run a HTTP server that replays responses from a HAR file by looking up the incoming request by specific properties. The incoming requests and outgoing responses can be recorded to a new HAR file.

Options:
  --port <port>                         
  --input <har_file>                    
  --ignore-hostname                      (default: false)
  --ignore-port                          (default: false)
  --match-headers <header>               (default: [])
  --ignore-headers <header>              (default: [])
  --ignore-header-casing                 (default: false)
  --ignore-header-order                  (default: false)
  --match-query-string-params <param>    (default: [])
  --ignore-query-string-params <param>   (default: [])
  --ignore-query-string-param-order      (default: false)
  --ignore-post-data                     (default: false)
  --record <har_file>                   
```

### `transform`

```text
Usage: harhar transform [options]

Transforms a HAR file and outputs the result to a new HAR file.

Options:
  --input <har_file>                    
  --output <har_file>                   
  --ignore-headers <header>              (default: [])
  --ignore-query-string-params <param>   (default: [])
  --match-headers <header>               (default: [])
  --match-query-string-params <param>    (default: [])
  --normalize-header-names              
  --remove-query-string-from-url        
  --replace-hostname <new_hostname>     
  --replace-port <new_port>             
  --replace-protocol <new_protocol>     
  --replace-status-text <status_text>   
  --scrub-timings                       
  --scrub-sizes                         
  --sort-headers                        
  --sort-query-string-params            
```

### `diff`

```text
Usage: harhar diff [options] <input1> <input2>

Compares two HAR files for differences.
It does so by looking up X-Request-ID headers to find matching requests and shows what parts of the requests and responses are different.
```
