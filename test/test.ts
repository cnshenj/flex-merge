// import stringify from "fast-json-stable-stringify";
import { MatchAction, merge, MergeOptions, NoMatchAction } from "../src/flex-merge";

const srcString = "Hello, world!";
const object1 = { prop: { foo: { name: "foo", size: 1 }, bar: [{ name: "bar", value: [1, 2] }] } };
const object2 = { prop: { foo: { name: "FOO", length: 2 }, bar: [{ name: "bar", value: [3] }] } };

function cloneDeep(value: unknown): unknown {
    const type = typeof value;
    return type === "undefined" || type === "string"
        ? value
        : JSON.parse(JSON.stringify(value));
}

test("undefined replaced", () => {
    const merged = merge(undefined, srcString);
    expect(merged).toEqual(srcString);
});

test("null replaced", () => {
    const merged = merge(null, srcString);
    expect(merged).toEqual(srcString);
});

test("Number replaced", () => {
    const merged = merge(1, srcString);
    expect(merged).toEqual(srcString);
});

test("Boolean replaced", () => {
    const merged = merge(true, srcString);
    expect(merged).toEqual(srcString);
});

test("String replaced", () => {
    const merged = merge("foobar", srcString);
    expect(merged).toEqual(srcString);
});

test("Non-plain object replaced", () => {
    const merged = merge(new Date(), srcString);
    expect(merged).toEqual(srcString);
});

test("Plain object merged", () => {
    const merged = merge({ foo: 1, bar: 2 }, { foo: srcString });
    expect(merged).toEqual({ foo: srcString, bar: 2 });
});

test("Nested plain object merged", () => {
    const merged = merge(cloneDeep(object1), cloneDeep(object2));
    expect((<any>merged).prop.foo).toEqual({ name: "FOO", size: 1, length: 2 });
});

test("Nested plain object replaced with rule", () => {
    const options: MergeOptions = {
        rules: { "$.prop.foo": MatchAction.replace }
    };
    const merged = merge(cloneDeep(object1), cloneDeep(object2), options);
    expect((<any>merged).prop.foo).toEqual(object2.prop.foo);
});

test("Array merged", () => {
    const merged = merge([1, 2], [1, 3]);
    expect(merged).toEqual([1, 2, 3]);
});

test("Array merged by prepend", () => {
    const merged = merge([1, 2], [1, 3], { rules: { "/": { notMatched: NoMatchAction.prepend } } });
    expect(merged).toEqual([3, 1, 2]);
});

test("Array merged with duplicates", () => {
    const merged = merge([1, 2], [1, 3], { rules: { "/": { match: null } } });
    expect(merged).toEqual([1, 2, 1, 3]);
});

test("Array merged with custom match", () => {
    const options: MergeOptions = {
        rules: {
            "$.prop.bar": { match: (x, y) => x.name === y.name }
        }
    };
    const merged = merge(cloneDeep(object1), cloneDeep(object2), options);
    expect((<any>merged).prop.bar).toEqual([{ name: "bar", value: [1, 2, 3] }]);
});

test("Rule with glob pattern", () => {
    const options: MergeOptions = {
        rules: {
            "$.**.bar": { match: (x, y) => x.name === y.name }
        }
    };
    const merged = merge(cloneDeep(object1), cloneDeep(object2), options);
    expect((<any>merged).prop.bar).toEqual([{ name: "bar", value: [1, 2, 3] }]);
});

test("Merge multiple sources", () => {
    const merged = merge([
        {
            foo: 1, // Overwritten twice
            bar: {
                a: 1, // Overwritten by first source
                b: 1 // Overwritten by second source
            }
        },
        {
            foo: 2,
            bar: {
                a: 2,
            }
        },
        {
            foo: 3,
            bar: {
                b: 3
            }
        }
    ]);
    expect(merged).toEqual({ foo: 3, bar: { a: 2, b: 3 } });
});

const baseConfig = {
    module: {
        rules: [
            {
                test: /\.scss$/,
                use: [
                    "css-loader",
                    "sass-loader"
                ]
            }
        ]
    }
};

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
};

test("webpack configuration", () => {
    const options: MergeOptions = {
        rules: {
            "$.module.rules": { match: (x, y) => x.test.source === y.test.source },
            "$.module.rules[].use": { notMatched: NoMatchAction.prepend }
        }
    };
    const merged = merge(baseConfig, extendConfig, options);
    expect(merged).toEqual({
        module: {
            rules: [
                {
                    test: /\.scss$/,
                    use: [
                        "style-loader",
                        "css-loader",
                        "sass-loader"
                    ]
                }
            ]
        }
    });
});
