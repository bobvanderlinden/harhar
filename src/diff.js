const { getValueByName } = require("./name-value");
const { readHarFile } = require("./har");
const { default: diffDefault } = require("jest-diff");
const { createCommandAction } = require("./command-utils");

function indexByRequestId(entries) {
  const result = {};
  for (const entry of entries) {
    const requestId = getValueByName(entry.request.headers, "x-request-id", {
      caseSensitive: false,
    });
    if (!requestId) {
      continue;
    }
    result[requestId] = result[requestId]
      ? result[requestId].concat([entry])
      : [entry];
  }
  return result;
}

async function diff(input1, input2) {
  const inputs = [await readHarFile(input1), await readHarFile(input2)];
  // inputs[0].log.entries = inputs[0].log.entries.slice(0, 3);
  // inputs[1].log.entries = inputs[1].log.entries.slice(0, 3);

  const inputEntriesByRequestId = inputs.map((input) =>
    indexByRequestId(input.log.entries)
  );
  const requestIds = [
    ...new Set(inputEntriesByRequestId.flatMap((map) => Object.keys(map))),
  ];
  const pairs = requestIds.map((requestId) =>
    inputEntriesByRequestId.map(
      (entriesByRequestId) => entriesByRequestId[requestId] || []
    )
  );
  const unmatchingPairs = pairs.filter(
    ([entry1, entry2]) => !Object.is(entry1, entry2)
  );
  for (const [entry1, entry2] of unmatchingPairs) {
    const diffString = diffDefault(entry1, entry2, {
      contextLines: 100,
      expand: true,
      omitAnnotationLines: true,
    });
    if (diffString.includes("Compared values have no visual difference.")) {
      continue;
    }
    console.log(diffString);
  }
}

function defineCommand(program) {
  return program
    .command("diff <input1> <input2>")
    .action(createCommandAction(diff));
}

module.exports = {
  diff,
  defineCommand,
};
