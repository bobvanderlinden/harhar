const program = require("commander");
const winston = require("winston");
const serverreplay = require("./serverreplay");
const clientreplay = require("./clientreplay");
const proxy = require("./proxy");
const diff = require("./diff");
const transform = require("./transform");
const validate = require("./validate");

program
  .name("harhar")
  .option("--debug", "Output debug information")
  .once("option:debug", () => {
    winston.configure({
      transports: [
        new winston.transports.Console({
          level: "debug",
          stderrLevels: ["debug", "info", "warn", "error"],
        }),
      ],
    });
  });

const subprograms = [
  serverreplay,
  clientreplay,
  proxy,
  diff,
  transform,
  validate,
];

for (const subprogram of subprograms) {
  subprogram.defineCommand(program);
}

program.command("*").action(() => {
  program.help();
});

function main(argv) {
  winston.configure({
    transports: [
      new winston.transports.Console({
        level: "info",
        stderrLevels: ["debug", "info", "warn", "error"],
      }),
    ],
  });

  program.parse(argv);
}

module.exports = {
  program,
  main,
};
