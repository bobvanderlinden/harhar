function compareName(nameValueA, nameValueB) {
  return nameValueA.name > nameValueB.name
    ? 1
    : nameValueA.name < nameValueB.name
    ? -1
    : 0;
}

function sortByName(nameValues) {
  return [...nameValues].sort(compareName);
}

function mapNames(nameValues, nameFn) {
  return nameValues.map(({ name, value }) => ({ name: nameFn(name), value }));
}

function getValuesByName(nameValues, name, { caseSensitive = true }) {
  return nameValues
    .filter((entry) =>
      caseSensitive
        ? entry.name === name
        : entry.name.toLowerCase() === name.toLowerCase()
    )
    .map((entry) => entry.value);
}

function getValueByName(nameValues, name, options) {
  return getValuesByName(nameValues, name, options).join(", ") || undefined;
}

function fromObject(obj) {
  return fromEntries(Object.entries(obj));
}

function fromEntries(entries) {
  return entries.flatMap(([name, value]) => {
    if (Array.isArray(value)) {
      return value.map((value) => ({ name, value }));
    } else {
      return { name, value: value };
    }
  });
}

function fromURLSearchParams(urlSearchParams) {
  return fromEntries([...urlSearchParams.entries()]);
}

function fromRawHeaders(rawHeaders) {
  const headers = [];
  for (let i = 0; i < rawHeaders.length; i += 2) {
    headers.push({ name: rawHeaders[i], value: rawHeaders[i + 1] });
  }
  return headers;
}

function toObject(nameValues) {
  const result = {};
  for (const { name, value } of nameValues) {
    if (Array.isArray(result[name])) {
      result[name].push(value);
    } else if (result[name] !== undefined) {
      result[name] = [result[name], value];
    } else {
      result[name] = value;
    }
  }
  return result;
}

function parseHeaders(headersString) {
  const headerLines = headersString.split("\r\n");
  return headerLines.map((headerLine) => {
    const [name, value] = headerLine.split(/: ?/, 2);
    return { name, value };
  });
}

function stringifyHeaders(nameValues) {
  return nameValues.map(({ name, value }) => `${name}: ${value}`).join("\r\n");
}

function matchIgnoreNames(
  nameValues,
  { matches, ignores, caseSensitive = true }
) {
  let result = nameValues;
  const compare = caseSensitive
    ? (a, b) => a.localeCompare(b)
    : (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
  if (matches && matches.length) {
    result = result.filter(({ name }) =>
      matches.some((match) => compare(match, name) === 0)
    );
  }
  if (ignores && ignores.length) {
    result = result.filter(
      ({ name }) => !ignores.some((ignore) => compare(ignore, name) === 0)
    );
  }
  return result;
}

function setValueByName(nameValues, name, newValue, { caseSensitive = true }) {
  const result = [];
  let isReplaced = false;
  for (const entry of nameValues) {
    const matchesName = caseSensitive
      ? entry.name === name
      : entry.name.toLowerCase() === name.toLowerCase();
    if (matchesName && !isReplaced) {
      result.push({
        name: entry.name,
        value: newValue,
      });
      isReplaced = true;
    } else if (matchesName && isReplaced) {
      // Skip this entry.
      continue;
    } else {
      result.push(entry);
    }
  }
  if (!isReplaced) {
    result.push({ name, value: newValue });
  }
  return result;
}

module.exports = {
  compareName,
  sortByName,
  mapNames,
  matchIgnoreNames,
  fromObject,
  fromEntries,
  fromURLSearchParams,
  fromRawHeaders,
  toObject,
  getValueByName,
  getValuesByName,
  setValueByName,
  parseHeaders,
  stringifyHeaders,
};
