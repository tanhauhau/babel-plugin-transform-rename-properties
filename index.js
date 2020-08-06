module.exports = function({ types: t }, options = {}) {
  const rename = options.rename || {};

  const nameMap = new Map();
  const usedKey = new Set();
  const toReplace = new Set();
  Object.keys(rename).forEach((key) => {
    const value = rename[key];
    if (typeof value !== 'string') {
      throw new Error(
        `New name for property ${JSON.stringify(key)} should be a string`
      );
    }
    nameMap.set(key, value);
    usedKey.add(value);
  });

  let cname = -1;

  const getNewName = (name, scope) => {
    let newName = nameMap.get(name);
    if (!newName && toReplace.has(name)) {
      do {
        newName = base54(++cname);
      } while (usedKey.has(newName));
      nameMap.set(name, newName);
    }
    return newName;
  };

  const replacePropertyOrMethod = {
    exit(path) {
      const node = path.node;

      let name;
      if (t.isIdentifier(node.key)) {
        name = node.key.name;
      } else if (t.isStringLiteral(node.key)) {
        name = node.key.value;
      } else {
        return;
      }

      const newName = getNewName(name);
      if (newName === undefined) {
        return;
      }

      const newNode = t.cloneNode(node, false);
      if (t.isIdentifier(node.key) && t.isValidIdentifier(newName)) {
        newNode.key = t.identifier(newName);
      } else {
        newNode.key = t.stringLiteral(newName);
      }
      path.replaceWith(newNode);
      path.skip();
    },
  };

  return {
    name: 'transform-rename-properties',
    visitor: {
      Program(
        path,
        {
          file: {
            ast: { comments },
          },
        }
      ) {
        for (const comment of comments) {
          const match = comment.value.match(/[* ]+@mangle (.+)[ *]+/);
          if (match) {
            const listOfVariables = JSON.parse(match[1].replace(/'/g, '"'));
            for (const name of listOfVariables) {
              if (typeof name === 'string') {
                toReplace.add(name);
              } else if (
                Array.isArray(name) &&
                name.length === 2 &&
                typeof name[0] === 'string' &&
                typeof name[1] === 'string'
              ) {
                nameMap.set(name[0], name[1]);
                usedKey.add(name[1]);
              } else {
                throw new Error(
                  `Unsupported @mangle item ${JSON.stringify(name)}`
                );
              }
            }
          }
        }
      },
      Property: replacePropertyOrMethod,
      Method: replacePropertyOrMethod,
      MemberExpression: {
        exit(path) {
          const node = path.node;
          const prop = node.property;

          let name;
          if (t.isIdentifier(node.property) && !node.computed) {
            name = node.property.name;
          } else if (t.isStringLiteral(node.property)) {
            name = node.property.value;
          } else {
            return;
          }

          const newName = getNewName(name);
          if (newName === undefined) {
            return;
          }

          let newNode;
          if (t.isValidIdentifier(newName)) {
            newNode = t.memberExpression(node.object, t.identifier(newName));
          } else {
            newNode = t.memberExpression(
              node.object,
              t.stringLiteral(newName),
              true
            );
          }
          path.replaceWith(newNode);
          path.skip();
        },
      },
    },
  };
};

const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_0123456789'.split(
  ''
);
function base54(num) {
  var ret = '',
    base = 54;
  num++;
  do {
    num--;
    ret += chars[num % base];
    num = Math.floor(num / base);
    base = 64;
  } while (num > 0);
  return ret;
}
