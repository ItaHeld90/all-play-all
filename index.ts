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

function times<T>(amount: number, fn: (idx: number) => T): T[] {
    const result: T[] = [];

    for (let idx = 0; idx < amount; idx++) {
        result.push(fn(idx));
    }

    return result;
}

function range(start: number, end: number): number[] {
    return times(end - start, idx => idx + start);
}

function shiftRobin<T>(amount: number, items: T[]): T[] {
    const [staticItem, ...movingItems] = items;

    return [
        staticItem,
        ...times(
            movingItems.length,
            idx =>
                movingItems[
                    (movingItems.length - amount + idx) % movingItems.length
                ]
        )
    ];
}

function isSentry<T>(item: RobinItem<T>): item is Symbol {
    return item === restSymbol;
}

function getDefaultTournamentOptions(): TouranmentOptions {
    return {
        rematch: false,
        playSelf: false
    };
}

function reverse<T>(arr: T[]): T[] {
    const result: T[] = [];

    for (let idx = arr.length - 1; idx >= 0; idx--) {
        result.push(arr[idx]);
    }

    return result;
}

function getShiftsOrder(numFixtures: number) {
    return shuffle(range(1, numFixtures));
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
    const { playSelf } = options;
    const robinItems: RobinItem<T>[] = shuffle(arr);

    if (playSelf) {
        robinItems.push(selfSymbol);
    }

    const isOdd = robinItems.length % 2 !== 0;

    if (isOdd) {
        robinItems.push(restSymbol);
    }

    return (function createByRobinItems(robinItems: RobinItem<T>[]) {
        return {
            rounds: () => getRounds(robinItems, options),
            fixtures: () => getRoundFixtures(robinItems, options),
            games: () => getRoundGames(robinItems, options),
            reshuffle: () => createByRobinItems(shuffle(robinItems))
        };
    })(robinItems);
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

            const shiftsOrder = getShiftsOrder(items.length - 1);

            for (
                let fixtureIdx = 0;
                fixtureIdx < shiftsOrder.length;
                fixtureIdx++
            ) {
                const shiftAmount = shiftsOrder[fixtureIdx];
                const currItems = shiftRobin(shiftAmount, items);
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
