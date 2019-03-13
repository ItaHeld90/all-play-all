export interface TournamentTemplate {
    create: <T>(arr: T[]) => Tournament<T>;
}
export interface Tournament<T> {
    rounds: () => Iterable<Round<T>>;
    fixtures: () => Iterable<Fixture<T>>;
    games: () => Iterable<Game<T>>;
    reshuffle: () => Tournament<T>;
}
export type RobinItem<T> = T | Symbol;
export type Game<T> = [T, T];
export type Fixture<T> = Iterable<Game<T>>;
export type Round<T> = Iterable<Fixture<T>>;

export type TouranmentOptions = {
    rematch: boolean;
    playSelf: boolean;
    shuffle: boolean;
};

const restSymbol = Symbol.for('rest');
const selfSymbol = Symbol.for('self');

const randomInRange = (min: number, max: number) => {
    return Math.floor(min + Math.random() * (max - min + 1));
};

const swap = <T>(idx1: number, idx2: number, arr: T[]) => {
    const temp = arr[idx1];
    arr[idx1] = arr[idx2];
    arr[idx2] = temp;
};

const shuffle = <T>(arr: T[]): T[] => {
    const clonedArr = [...arr];

    function recurse(startIdx: number) {
        if (startIdx >= arr.length - 1) return;

        const rndIdx = randomInRange(startIdx, clonedArr.length - 1);
        swap(startIdx, rndIdx, clonedArr);
        recurse(startIdx + 1);
    }

    recurse(0);
    return clonedArr;
};

function last<T>(arr: T[]): T {
    return arr[arr.length - 1];
}

function shiftRobin<T>(items: T[]): T[] {
    const [staticItem, ...movingItems] = items;

    return [
        staticItem,
        last(movingItems),
        ...movingItems.slice(0, movingItems.length - 1)
    ];
}

function isSentry<T>(item: RobinItem<T>): item is Symbol {
    return item === restSymbol;
}

function getDefaultTournamentOptions(): TouranmentOptions {
    return {
        rematch: false,
        playSelf: false,
        shuffle: true
    };
}

function reverse<T>(arr: T[]): T[] {
    const result: T[] = [];

    for (let idx = arr.length - 1; idx >= 0; idx--) {
        result.push(arr[idx]);
    }

    return result;
}

export function allPlayAll<T>(
    options?: Partial<TouranmentOptions>
): TournamentTemplate {
    const calculatedOptions = {
        ...getDefaultTournamentOptions(),
        ...options
    };

    return {
        create: <T>(arr: T[]) => createTournament(arr, calculatedOptions)
    };
}

function createTournament<T>(
    arr: T[],
    options: TouranmentOptions
): Tournament<T> {
    const { playSelf, shuffle: shouldShuffle } = options;
    const robinItems: RobinItem<T>[] = shouldShuffle ? shuffle(arr) : [...arr];

    if (playSelf) {
        robinItems.push(selfSymbol);
    }

    const isOdd = robinItems.length % 2 !== 0;

    if (isOdd) {
        robinItems.push(restSymbol);
    }

    return {
        rounds: () => getRounds(robinItems, options),
        fixtures: () => getRoundFixtures(robinItems, options),
        games: () => getRoundGames(robinItems, options),
        reshuffle: () =>
            createTournament(shuffle(arr), { ...options, shuffle: true })
    };
}

function* getRounds<T>(
    items: RobinItem<T>[],
    { rematch }: TouranmentOptions
): Iterable<Round<T>> {
    yield getRound(items);

    if (rematch) {
        yield getRound(reverse(items));
    }
}

function* getRoundFixtures<T>(
    items: RobinItem<T>[],
    options: TouranmentOptions
): Iterable<Fixture<T>> {
    for (let round of getRounds(items, options)) {
        yield* round;
    }
}

function* getRoundGames<T>(
    items: RobinItem<T>[],
    options: TouranmentOptions
): Iterable<Game<T>> {
    for (let fixture of getRoundFixtures(items, options)) {
        yield* fixture;
    }
}

function getRound<T>(items: RobinItem<T>[]): Round<T> {
    return {
        *[Symbol.iterator]() {
            yield getFixture(items);

            let currItems = items;

            for (
                let fixtureIdx = 1;
                fixtureIdx < items.length - 1;
                fixtureIdx++
            ) {
                currItems = shiftRobin(currItems);
                yield getFixture(currItems);
            }
        }
    };
}

function getFixture<T>(items: RobinItem<T>[]): Fixture<T> {
    return {
        *[Symbol.iterator]() {
            const numItems = items.length;
            const numGames = Math.floor(numItems / 2);

            for (let gameIdx = 0; gameIdx < numGames; gameIdx++) {
                let leftItem = items[gameIdx];
                let rightItem = items[numItems - 1 - gameIdx];

                if (leftItem === selfSymbol) {
                    leftItem = rightItem;
                }

                if (rightItem === selfSymbol) {
                    rightItem = leftItem;
                }

                if (!isSentry(leftItem) && !isSentry(rightItem)) {
                    yield [leftItem, rightItem];
                }
            }
        }
    };
}
