import { assert, expect, test } from "vitest";
import { FixedBitSet } from "../src";
import { iter, range } from "joshkaposh-iterator";
import { trailing_zeros } from "../src/bit";
import { u32 } from "../src/Intrinsics";

function time(label: string, fn: () => void) {
    console.time(label);
    fn()
    console.timeEnd(label);
}

test('insert_range', () => {
    const fbs_a = FixedBitSet.with_capacity(1_000_000);
    console.time('insert_range a');
    fbs_a.insert_range(250_000, 500_000);
    console.timeEnd('insert_range a');

    console.time('remove_range')
    fbs_a.remove_range(250_000, 500_000)
    console.timeEnd('remove_range')
})


test('toggle_range', () => {
    const fbs = FixedBitSet.with_capacity(10_000);

    fbs.toggle_range(373, 690);
    assert(fbs.contains_all_in_range(373, 690))
    fbs.toggle_range(373, 690);
    assert(fbs.is_clear())
})

test('remove_range', () => {
    const fbs = FixedBitSet.with_capacity(10_000);

    fbs.insert_range(373, 690);
    assert(fbs.contains_all_in_range(373, 690))
    fbs.remove_range(373, 690);
    assert(fbs.is_clear())
})

test('count_ones', () => {
    const fbs_a = FixedBitSet.with_capacity(100);

    fbs_a.insert_range(50, 100);


    time('count_ones', () => fbs_a.count_ones());


    time('count_zeroes', () => fbs_a.count_zeroes());
})

test('trailing_zeroes', () => {
    assert(trailing_zeros(0b0101000) === 3);
    assert(trailing_zeros(0b0100000) === 5);
    assert(trailing_zeros(0) === 32);
    assert(trailing_zeros(u32.MAX) === 0);

})

test('it works', () => {
    const fbs = FixedBitSet.with_capacity(10);

    fbs.insert(0);
    fbs.grow(40);

    assert(fbs.contains(0));
    fbs.insert(35);
    fbs.remove(0);
    assert(!fbs.contains(0));
    assert(!fbs.put(0));
    assert(fbs.put(0));

    fbs.insert(9);
    fbs.insert(31);

    assert(fbs.count_ones() === 4);
    assert(fbs.count_zeroes() === 36);

    fbs.clear();
    assert(fbs.count_ones() === 0);
    assert(fbs.count_zeroes() === 40);
    fbs.insert_range(5, 10);

    assert(fbs.count_ones() === 5);
    assert(!fbs.contains(4));
    assert(fbs.contains(5));
    assert(fbs.contains(6));
    assert(fbs.contains(7));
    assert(fbs.contains(8));
    assert(fbs.contains(9));
    assert(!fbs.contains(10));

    fbs.grow(1000);
    fbs.clear();
    assert(fbs.count_ones() === 0)
    fbs.insert_range(250, 500);
    assert(fbs.contains_all_in_range(250, 500))
    assert(!fbs.contains_all_in_range(249, 500))

    assert(fbs.count_ones() === 250);

    let i = 250;
    const expected = Array.from({ length: 250 }, () => {
        const prev = i;
        i++;
        return prev;
    })

    expect(fbs.ones().collect()).toEqual(expected);

    const zeroes = fbs.zeroes();
    assert(zeroes.all(b => !expected.includes(b)));
})

test('remove', () => {
    const fbs = FixedBitSet.with_capacity(10);

    fbs.insert(5);
    assert(fbs.contains(5));
    fbs.remove(5);
    assert(!fbs.contains(5));
    assert(fbs.is_clear());
})

test('put', () => {
    const fbs = FixedBitSet.with_capacity(10000);
    assert(!fbs.put(5000));
    assert(fbs.put(5000));
})

test('ones_and_zeroes', () => {
    const fbs = FixedBitSet.with_capacity(10);
    fbs.insert(0);
    fbs.insert(9)
    expect(fbs.ones().collect()).toEqual([0, 9]);

    fbs.clear();
    fbs.grow(100);

    fbs.insert(0);
    fbs.insert(50);
    fbs.insert(99);


    expect(fbs.ones().collect()).toEqual([0, 50, 99]);
    expect(fbs.zeroes().count() === 97);
    assert(fbs.zeroes().all(b => b !== 0 && b !== 50 && b !== 99))

    fbs.clear();
    fbs.grow(1000);
    fbs.insert_range(250, 500);

    assert(fbs.ones().all(b => b >= 250 && b < 500));
    assert(fbs.zeroes().all(b => b < 250 || b >= 500))
})

test('count_ones_count_zeroes', () => {
    const fbs = FixedBitSet.with_capacity(10);
    fbs.insert(0)
    fbs.insert(6)
    fbs.insert(7)

    assert(fbs.count_ones() === 3);
    assert(fbs.count_zeroes() === 7);

    fbs.insert(2)
    fbs.insert(8)
    fbs.insert(9)

    assert(fbs.count_ones() === 6);
    assert(fbs.count_zeroes() === 4);

    fbs.toggle(2)

    assert(fbs.count_ones() === 5);
    assert(fbs.count_zeroes() === 5);
})

test('difference', () => {
    let a = FixedBitSet.with_capacity(20)
    let b = FixedBitSet.with_capacity(20)
    a.insert_range(0, 10);
    b.insert_range(5, 20);

    expect(a.difference(b).collect()).toEqual([0, 1, 2, 3, 4]);
})

test('symmetric_difference', () => {
    let a = FixedBitSet.with_capacity(20)
    let b = FixedBitSet.with_capacity(20)
    a.insert_range(0, 15)
    b.insert_range(10, 20);

    expect(a.symmetric_difference(b).collect()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19])
})

test('intersection', () => {
    const a = FixedBitSet.with_capacity(21);
    const b = FixedBitSet.with_capacity(21);

    a.insert_range(0, 15);
    b.insert_range(8, 21)

    expect(a.intersection(b).collect()).toEqual(range(8, 15).collect())
})

test('union', () => {
    const a = FixedBitSet.with_capacity(10);
    const b = FixedBitSet.with_capacity(10);
    const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    a.insert_range(0, 5)
    b.insert_range(5, 10);
    expect(a.union(b).collect()).toEqual(expected);
})
