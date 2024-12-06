import { test, expect } from 'vitest'
import { FixedBitSet } from '../src'
import { iter, range } from 'joshkaposh-iterator';

test('ones', () => {
    const fbs = FixedBitSet.with_capacity(10);
    fbs.insert_range();
    const ones = fbs.ones()
    expect(ones.rev().collect()).toEqual(range(0, 10).rev().collect())

})

test('it works', () => {

    const fbs = new FixedBitSet();

    for (let i = 0; i < 10; i++) {
        fbs.grow_insert(i);
    }

    fbs.grow(20);

    expect(fbs.ones().collect()).toEqual(range(0, 10).collect())

    fbs.insert(15)
    fbs.insert(17)
    fbs.insert(18)
    fbs.insert(19)

    expect(fbs.ones().collect()).toEqual(range(0, 10).chain(iter.of(15, 17, 18, 19)).collect())
})

test('range_operations', () => {
    const fbs = FixedBitSet.with_capacity(10);
    const ones = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    fbs.toggle_range();
    expect(fbs.ones().collect()).toEqual(ones)
    fbs.toggle_range(4, 8);
    expect(fbs.ones().collect()).toEqual([0, 1, 2, 3, 8, 9])
    fbs.clear();
    fbs.grow(10);
    fbs.insert_range(0, 10)
    expect(fbs.ones().collect()).toEqual(ones)
    fbs.set_range(range(4, 8), false);
    expect(fbs.ones().collect()).toEqual([0, 1, 2, 3, 8, 9])

})

test('difference', () => {
    let a = FixedBitSet.with_capacity(10)
    let b = FixedBitSet.with_capacity(10)
    a.insert_range(range(0, 6))
    b.insert_range(range(6, 10))
    expect(a.difference(b).collect()).toEqual(range(0, 6).collect())
})

test('symmetric_difference', () => {
    let a = FixedBitSet.with_capacity(20)
    let b = FixedBitSet.with_capacity(20)
    a.insert_range(range(0, 11))
    b.insert_range(range(15, 20));

    console.log(a.symmetric_difference(b).collect());
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
    const expected = Array.from({ length: 10 }, (_, i) => i)

    a.insert_range(0, 5)
    b.insert_range(5, 10);
    expect(a.union(b).collect()).toEqual(expected)
})