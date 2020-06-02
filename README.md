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

### serverreplay

Usage: `harhar serverreplay [options]`

Run a HTTP server that replays responses from a HAR file by looking up the incoming request by specific properties. The incoming requests and outgoing responses can be recorded to a new HAR file.

* `--port <port>`: 
* `--input <har_file>`: 
* `--match-request-id`: 
* `--ignore-hostname`: 
* `--ignore-port`: 
* `--match-headers <header>`: 
* `--ignore-headers <header>`: 
* `--ignore-header-casing`: 
* `--ignore-header-order`: 
* `--match-query-string-params <param>`: 
* `--ignore-query-string-params <param>`: 
* `--ignore-query-string-param-order`: 
* `--ignore-post-data`: 
* `--record <har_file>`: 

### clientreplay

Usage: `harhar clientreplay [options]`

Replays the requests of a HAR file. The responses that were sent back can optionally be recorded to a new HAR file.

* `--input <har_file>`: 
* `--record <har_file>`: 
* `--replace-hostname <new_hostname>`: 
* `--replace-port <new_port>`: 

### proxy

Usage: `harhar proxy [options]`

Record traffic between a HTTP client and server. This passes incoming requests towards a host and passes the resulting response back to the client.
This records incoming requests and outgoing responses.

* `--listen-port <port>`: 
* `--listen-host <host>`: 
* `--connect-host <host>`: 
* `--connect-port <port>`: 
* `--record <har_file>`: 

### diff

Usage: `harhar diff [options] <input1> <input2>`

Compares two HAR files for differences.
It does so by matching requests on specific properties. These properties can be specified using the --match-* options.
Requests that match are compared by all properties and the diff is shown for each differing entry.
Note that this does not match requests based on ordering.

* `-C, --context <lines>`: Output number of lines of copied context
* `--match-request-id`: Match entries on x-request-id header of requests
* `--match-started-date-time`: Match entries on startedDateTime
* `--match-method`: Match entries on request method
* `--match-url`: Match entries on request URL
* `--match-pathname`: Match entries on pathname part of request URL
* `--match-query`: Match entries on query-string parameters
* `--match-header <header>`: Match entries on (one or more) request header(s)

### transform

Usage: `harhar transform [options]`

Transforms a HAR file and outputs the result to a new HAR file.

* `--input <har_file>`: 
* `--output <har_file>`: 
* `--ignore-headers <header>`: 
* `--ignore-query-string-params <param>`: 
* `--match-headers <header>`: 
* `--match-query-string-params <param>`: 
* `--match-multipart-headers <header>`: 
* `--ignore-multipart-headers <header>`: 
* `--normalize-header-names`: 
* `--remove-query-string-from-url`: 
* `--replace-hostname <new_hostname>`: 
* `--replace-port <new_port>`: 
* `--replace-protocol <new_protocol>`: 
* `--replace-status-text <status_text>`: 
* `--replace-multipart-boundary <new_boundary>`: 
* `--scrub-timings`: 
* `--scrub-sizes`: 
* `--sort-headers`: 
* `--sort-query-string-params`: 
* `--sort-multipart`: 
* `--fabricate-request-ids`: Adds request ids to all requests and responses that do not already have request ids

### validate

Usage: `harhar validate [options]`

Validates a HAR file.

* `--input <har_file>`: 
* `--require-request-header <header_name>`: 
* `--require-response-header <header_name>`: 