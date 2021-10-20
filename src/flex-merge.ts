import minimatch from "minimatch";

export enum MatchAction {
    // eslint-disable-next-line no-shadow
    merge = "merge",
    replace = "replace"
}

export enum NoMatchAction {
    prepend = "prepend",
    append = "append"
}

export type ArrayMergeAction = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    match?: ((x: any, y: any) => boolean) | null,
    matched?: MatchAction,
    notMatched?: NoMatchAction
};

export type MergeAction = MatchAction | ArrayMergeAction;

export type MergeOptions = {
    rules?: Record<string, MergeAction>
};

export function merge(dest: unknown, src: unknown, options?: MergeOptions): unknown;
export function merge(values: unknown[], options?: MergeOptions): unknown;
export function merge(arg1: unknown, arg2?: unknown | MergeOptions, arg3?: MergeOptions): unknown {
    if (!Array.isArray(arg1) || !(typeof arg2 === "undefined" || isPlainObject(arg2))) {
        return mergePair(arg1, arg2, arg3);
    }

    if (typeof arg3 !== "undefined") {
        throw new Error("merge(values, options) only expects 2 arguments.");
    }

    if (arg1.length === 0) {
        return undefined;
    } else if (arg1.length === 1) {
        return arg1[0];
    }

    let dest = arg1[0] as unknown;
    for (let i = 1; i < arg1.length; ++i) {
        dest = mergePair(dest, arg1[i]);
    }

    return dest;
}

function mergePair(dest: unknown, src: unknown, options?: MergeOptions): unknown {
    const rootPath = isPlainObject(dest) ? "" : "/";
    return mergeValues(dest, src, rootPath, convertOptions(options));
}

function isPlainObject(value: unknown): boolean {
    return typeof value === "object" && value !== null && value.constructor === Object;
}

function mergeValues(dest: unknown, src: unknown, path: string, options?: MergeOptions): unknown {
    if (typeof dest !== "object" || dest === null) {
        return src;
    }

    if (dest.constructor === Object) {
        if (isPlainObject(src)) {
            return mergeObjects(<PlainObject>dest, <PlainObject>src, path, options);
        }
    } else if (Array.isArray(dest) && Array.isArray(src)) {
        return mergeArrays(dest, src, path, options);
    }

    return src;
}

type PlainObject = Record<string, unknown>;

function mergeObjects(dest: PlainObject, src: PlainObject, path: string, options?: MergeOptions): PlainObject {
    const tentativeAction = findAction(path, options);
    const action = typeof tentativeAction === "string" ? tentativeAction : (tentativeAction?.matched ?? MatchAction.merge);
    if (action === MatchAction.replace) {
        return src;
    }

    for (const key in src) {
        dest[key] = key in dest
            ? mergeValues(dest[key], src[key], `${path}/${key}`, options)
            : src[key];
    }

    return dest;
}

const defaultArrayMergeAction: Required<ArrayMergeAction> = {
    match: (x, y) => x === y,
    matched: MatchAction.merge,
    notMatched: NoMatchAction.append
};

function mergeArrays(dest: unknown[], src: unknown[], path: string, options?: MergeOptions): unknown[] {
    let action = findAction(path, options) ?? defaultArrayMergeAction;
    if (typeof action === "string") {
        if (action === MatchAction.replace) {
            return src;
        } else {
            action = defaultArrayMergeAction;
        }
    }

    const { match, matched, notMatched } = action;
    if (!match) {
        // Elements will never match, array concatenation is enough
        return notMatched === NoMatchAction.prepend ? src.concat(dest) : dest.concat(src);
    }

    for (const srcElement of src) {
        const index = dest.findIndex(element => match(element, srcElement));
        if (index < 0) {
            if (notMatched === NoMatchAction.prepend) {
                dest.unshift(srcElement);
            } else {
                dest.push(srcElement);
            }
        } else {
            dest[index] = matched === MatchAction.replace
                ? srcElement
                : mergeValues(dest[index], srcElement, path + "[]", options);
        }
    }

    return dest;
}

function convertOptions(options?: MergeOptions): MergeOptions | undefined {
    const rules = options?.rules;
    if (!rules) {
        return options as MergeOptions;
    }

    const convertedRules: Record<string, MergeAction> = {};
    for (const key in rules) {
        let action = rules[key];
        if (typeof action !== "string") {
            // Make sure the array merge action has all properties
            action = Object.assign({}, defaultArrayMergeAction, action);
        }

        convertedRules[key.replace(/^\$\.?/, "/").replace(/\./g, '/')] = action;
    }

    return Object.assign({}, options, { rules: convertedRules }) as MergeOptions;
}

function findAction(path: string, options?: MergeOptions): MergeAction | undefined {
    const rules = options?.rules;
    if (!rules) {
        return undefined;
    }

    for (const key in rules) {
        if (minimatch(path, key)) {
            return rules[key];
        }
    }

    return undefined;
}