const { readHarFile } = require("./har");
const { getValueByName } = require("./name-value");
const { collect, createCommandAction } = require("./command-utils");
const harValidator = require("har-validator");

async function validateHarSchema(har) {
  try {
    await harValidator.har(har);
    return [];
  } catch (error) {
    if (error.name !== "HARError") {
      throw error;
    }
    return error.errors;
  }
}

function errorPathPrefixer(...prefixes) {
  return (error) => ({
    ...error,
    path: [...prefixes, ...error.path],
  });
}

function validateRequestRequirements({ request, options }) {
  return [
    ...options.requireRequestHeader.flatMap((requiredHeader) => {
      return getValueByName(request.headers, requiredHeader, {
        caseSensitive: false,
      })
        ? []
        : [
            {
              path: ["headers"],
              message: `Required header '${requiredHeader}' was not found`,
            },
          ];
    }),
  ].map(errorPathPrefixer("request"));
}

function validateResponseRequirements({ response, options }) {
  return [
    ...options.requireResponseHeader.flatMap((requiredHeader) => {
      return getValueByName(response.headers, requiredHeader, {
        caseSensitive: false,
      })
        ? []
        : [
            {
              path: ["headers"],
              message: `Required header '${requiredHeader}' was not found`,
            },
          ];
    }),
  ].map(errorPathPrefixer("response"));
}

function validateEntryRequirements({ index, entry, options }) {
  return [
    ...(entry.request &&
      validateRequestRequirements({ request: entry.request, options })),
    ...(entry.response &&
      validateResponseRequirements({ response: entry.response, options })),
  ].map(errorPathPrefixer(index));
}

function validateHarRequirements(har, options) {
  return har.log.entries
    .flatMap((entry, index) =>
      validateEntryRequirements({ index, entry, options })
    )
    .map(errorPathPrefixer("log", "entries"))
    .map(({ path, ...error }) => {
      return {
        ...error,
        dataPath: path
          .map((segment) =>
            typeof segment === "number" ? `[${segment}]` : `.${segment}`
          )
          .join(""),
      };
    });
}

async function validateHar(har, options) {
  return [
    ...(await validateHarSchema(har)),
    ...validateHarRequirements(har, options),
  ];
}

async function validate({ input, ...options }) {
  const harInput = await readHarFile(input);
  const validationErrors = await validateHar(harInput, options);
  console.log(validationErrors);
}

function defineCommand(program) {
  return program
    .command("validate")
    .description(`Validates a HAR file.`)
    .requiredOption("--input <har_file>")
    .option("--require-request-header <header_name>", "", collect, [])
    .option("--require-response-header <header_name>", "", collect, [])
    .action(createCommandAction(validate));
}

module.exports = {
  validate,
  validateHar,
  defineCommand,
};
