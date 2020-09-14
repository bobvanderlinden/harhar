const { getValueByName } = require("./name-value");
const { readHarFile } = require("./har");
const { default: diffDefault } = require("jest-diff");
const { createCommandAction, collect } = require("./command-utils");
const hash = require("object-hash");

function hashEntry(entry, options) {
  const requestId = getValueByName(entry.request.headers, "x-request-id", {
    caseSensitive: false,
  });

  if (options.matchRequestId && requestId) {
    return requestId;
  }
  const hashObject = {
    startedDateTime: options.matchStartedDateTime && entry.startedDateTime,
    method: options.matchMethod && entry.request.method,
    url: options.matchUrl && entry.request.url,
    pathname:
      options.matchPathname &&
      entry.request.url &&
      new URL(entry.request.url).pathname,
    query: options.matchQuery && entry.request.query,
    headers: options.matchHeader.map((matchHeader) =>
      getValueByName(entry.request.headers, matchHeader, {
        caseSensitive: false,
      })
    ),
  };

  return hash(hashObject);
}

function indexByHash(entries, options) {
  const result = {};
  for (const entry of entries) {
    const hash = hashEntry(entry, options);
    result[hash] = result[hash] ? result[hash].concat([entry]) : [entry];
  }
  return result;
}

function stringifyEntry(entry) {
  return Object.entries({
    startedDateTime: entry.startedDateTime,
    method: entry.request.method,
    url: entry.request.url,
    requestId:
      entry.request &&
      entry.request.headers &&
      getValueByName(entry.request.headers, "x-request-id", {
        caseSensitive: false,
      }),
  })
    .filter(([, value]) => value)
    .map(([name, value]) => `${name}:${value}`)
    .join(" ");
}

async function diff(input1, input2, options) {
  const inputs = [await readHarFile(input1), await readHarFile(input2)];

  const inputEntriesByRequestId = inputs.map((input) =>
    indexByHash(input.log.entries, options)
  );
  const requestIds = [
    ...new Set(inputEntriesByRequestId.flatMap((map) => Object.keys(map))),
  ];
  const pairs = requestIds.map((requestId) =>
    inputEntriesByRequestId.map(
      (entriesByRequestId) => entriesByRequestId[requestId] || []
    )
  );
  let foundDifference = false;
  const unmatchingPairs = pairs.filter(
    ([entry1, entry2]) => !Object.is(entry1, entry2)
  );
  for (const [entry1, entry2] of unmatchingPairs) {
    if (entry1.length === 0 || entry2.length === 0) {
      foundDifference = true;
      console.log(
        [`--- ${input1}`, `+++ ${input2}`]
          .concat(entry1.map((entry) => `-- ${stringifyEntry(entry, options)}`))
          .concat(entry2.map((entry) => `++ ${stringifyEntry(entry, options)}`))
          .join("\n")
      );
    } else {
      const diffString = diffDefault(entry1, entry2, {
        contextLines: options.context,
        expand: false,
        omitAnnotationLines: true,
        includeChangeCounts: false,
      });
      if (diffString.includes("Compared values have no visual difference.")) {
        continue;
      }
      foundDifference = true;
      console.log(
        [`--- ${input1}`, `+++ ${input2}`]
          .concat(entry1.map((entry) => `-- ${stringifyEntry(entry)}`))
          .concat(entry2.map((entry) => `++ ${stringifyEntry(entry)}`))
          .join("\n")
      );
      console.log(diffString);
    }
  }

  // Set exitCode to failure if there are differences between inputs.
  process.exitCode = foundDifference ? 1 : 0;
}

function defineCommand(program) {
  return program
    .command("diff <input1> <input2>")
    .description(
      `Compares two HAR files for differences.
It does so by matching requests on specific properties. These properties can be specified using the --match-* options.
Requests that match are compared by all properties and the diff is shown for each differing entry.
Note that this does not match requests based on ordering.`
    )
    .option(
      "-C, --context <lines>",
      "Output number of lines of copied context",
      parseInt,
      3
    )
    .option(
      "--match-request-id",
      "Match entries on x-request-id header of requests",
      false
    )
    .option(
      "--match-started-date-time",
      "Match entries on startedDateTime",
      false
    )
    .option("--match-method", "Match entries on request method", false)
    .option("--match-url", "Match entries on request URL", false)
    .option(
      "--match-pathname",
      "Match entries on pathname part of request URL",
      false
    )
    .option("--match-query", "Match entries on query-string parameters", false)
    .option(
      "--match-header <header>",
      "Match entries on (one or more) request header(s)",
      collect,
      []
    )
    .action(createCommandAction(diff));
}

module.exports = {
  diff,
  defineCommand,
};
