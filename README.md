# flex-merge - Merge with simple and powerful customization
There are many JavaScript libraries that merge values. Some of them can be customized to handle very specific scenarios.
For example: webpack-merge v4 can merge webpack configurations with customizations.
But webpack-merge v5 removed these webpack-specific customizations and replaced them with more generic options.
These generic options require more code to customize the merge of webpack configurations.

flex-merge is designed to use very simple generic rules to provide powerful customizations.
It's not designed specifically for webpack configurations, but works very well with them.
For example, given the following webpack configurations:
```js
const baseConfig = {
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          "css-loader",
          "sass-loader"
        ]
      },
      // Many other rules
    ]
  },
  // Many other options
}

const extendConfig = {
  module: {
    rules: [
      {
        test: /\.scss$/,
        use: [
          "style-loader"
        ]
      }
    ]
  }
}
```
The intention is to merge the `/\.scss$/` rule so it uses `style-loader` on top of `css-loader` and `sass-loader`.
With flex-merge, it can be done this way:
```js
const options = {
  rules: {
    "$.module.rules": { match: (x, y) => x.test.source === y.test.source } // Elements with the same 'test' value are considered the same element
    "$.module.rules[].use": { notMatched: "prepend" } // Prepend any 'use' elements not found in baseConfig
  }
};
merge(baseConfig, extendConfig, options);
```

## Installation
`npm install --save flex-merge`

## Usage
### Basic usage
```typescript
import { merge } from "flex-merge";

// One source
merge(dest, src, options?);

// Multiple sources
merge([dest, ...src], options?);
```
Note: values (both `dest` and `src`) may be mutated during merge. Create a deep clone first if you want to preserve original values.

### Default merge actions
- Plain objects will be recursively merged by merging every property.
- Array elements are compared by strict equality `===`.
  - If a `src` element already exists in `dest`, it will be merged.
  - If a `src` element doesn't exist in `dest`, it will be appended.
- All other values from `src` will overwrite `dest`.
  - TODO: Add default merge actions for collection types, such as `Set`, `Map`.
  - TODO: Support custom merge functions.

Note: A `src` property whose value is `undefined` is considered valid and will overwrite the `dest` property.
To avoid overwriting `dest` property, the property should **not** exist in `src`.
```js
merge({ foobar: "hello" }, { foobar: undefined }); // => { foobar: undefined }
merge({ foobar: "hello" }, { }); // => { foobar: "hello" }
```

### Custom merge options
Provide custom merge rules (scope + action) to customize how values are merged.
```typescript
const options = {
  rules: {
    "scope1": action1,
    "scope2": action2,
    ...
  }
};
merge(dest, src, options);
```

Scopes are like JavaScript member access and indexer expressions, with some modifications:
- `$` means root.
- `[]` means array elements. Do **not** use it for member access.

For example, to match `bar` in `{ foo: [ { bar: "hello" } ] }`, use scope `$.foo[].bar`.
[Glob](https://github.com/isaacs/minimatch)-like patterns are also supported, e.g. `$**.bar`.

Actions can be simple strings:
- `merge` (default) means recursively merge the values.
- `replace` means replace `dest` with `src`.

Actions can also be objects to customize how to merge arrays:
```typescript
export type ArrayMergeAction = {
    // Determine whether two elements are equal, default is strict equality '==='
    match?: ((x: any, y: any) => boolean) | null,

    // What to do when an element already exists in `dest`, default is 'merge'
    matched?: "merge" | "replace",

    // What to do when an element does not exist in `dest`, default is 'append'
    notMatched?: "append" | "prepend",
};
```
When `match` is set to `null`, all elements are considered unique. `src` and `dest` will be simply concatenated.