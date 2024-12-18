import { test, expect, assert } from 'vitest'
import { FixedBitSet } from '../src'
import { iter, range } from 'joshkaposh-iterator';


test('insert_range', () => {
    const fbs = FixedBitSet.with_capacity(10);
    fbs.insert_range();
    expect(fbs.ones().collect()).toEqual([
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9
    ])
    fbs.clear();

    fbs.grow(1000)
    fbs.insert_range(range(100, 200));

    for (let i = 100; i < 200; i++) {
        assert(fbs.contains(i))
    }

    fbs.insert_range(range(400, 600))


    for (let i = 0; i < 1000; i++) {
        if (i < 100) {
            assert(!fbs.contains(i))
        } else if (i >= 100 && i < 200) {
            assert(fbs.contains(i))
        } else if (i >= 200 && i < 400) {
            assert(!fbs.contains(i))
        } else if (i >= 400 && i < 600) {
            assert(fbs.contains(i))
        } else {
            assert(!fbs.contains(i))
        }
    }

    fbs.grow(1_000_000);

    fbs.clear();

    fbs.insert_range(range(250_000, 500_000));

    for (let i = 0; i < 1_000_000; i++) {
        if (i < 250_000) {
            assert(!fbs.contains(i))
        } else if (i >= 250_000 && i < 500_000) {
            assert(fbs.contains(i))
        } else {
            assert(!fbs.contains(i))
        }
    }
})

test('toggle_range', () => {
    const fbs = FixedBitSet.with_capacity(10_000);

    fbs.toggle_range(range(373, 690));

    for (let i = 0; i < 10_000; i++) {
        if (i >= 373 && i < 690) {
            assert(fbs.contains(i))
        } else {
            assert(!fbs.contains(i))
        }
    }
    fbs.toggle_range(range(373, 690));
    assert(fbs.is_clear)

})

test('remove', () => {
    const fbs = FixedBitSet.with_capacity(10);

    fbs.insert(5);
    fbs.remove(5);

    assert(fbs.is_clear());
})

test('put', () => {
    const fbs = FixedBitSet.with_capacity(100000);
    assert(!fbs.put(5000))
    assert(fbs.put(5000))
})

test('zeroes', () => {
    const fbs = FixedBitSet.with_capacity(100);

    fbs.clear();


    assert(fbs.ones().count() === 0)
    // assert(fbs.zeroes().count() === 1000);

    // fbs.insert_range(100, 200)
    // console.log(fbs.ones().count());
    // console.log(fbs.count_zeroes());
    fbs.insert_range(range(50, 100))
    console.log(fbs.ones().count());
})

test('count_ones_count_zeroes', () => {
    const fbs = FixedBitSet.with_capacity(10);
    fbs.insert(0)
    fbs.insert(6)
    fbs.insert(7)

    // assert(fbs.count_ones() === 3);
    // assert(fbs.count_zeroes() === 7);

    fbs.insert(2)
    fbs.insert(8)
    fbs.insert(9)

    // assert(fbs.count_ones() === 6);
    // assert(fbs.count_zeroes() === 4);

    fbs.toggle(2)

    // assert(fbs.count_ones() === 5);
    // assert(fbs.count_zeroes() === 5);
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
    const ones = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    // fbs.insert_range();
    // expect(fbs.ones().collect()).toEqual(ones)
})

test('difference', () => {
    let a = FixedBitSet.with_capacity(10)
    let b = FixedBitSet.with_capacity(10)
    a.insert_range(range(0, 6))
    b.insert_range(range(8, 10))
    console.log('a', a.ones().collect());

    console.log('b', b.ones().collect());
    // expect(a.difference(b).collect()).toEqual(range(0, 6).collect())
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

    // a.insert_range(range(0, 15));
    // b.insert_range(range(8, 21))

    // expect(a.intersection(b).collect()).toEqual(range(8, 15).collect())
})

test('union', () => {
    const a = FixedBitSet.with_capacity(10);
    const b = FixedBitSet.with_capacity(10);
    const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    // a.insert_range(range(0, 5))
    // b.insert_range(range(5, 10));
    // console.log('Union', a.union(b).collect());

    // expect(a.union(b).collect()).toEqual(expected);

})

test('zeroes', () => {
    const fbs = FixedBitSet.with_capacity(10);

    fbs.insert(3)
    fbs.insert(4)
    fbs.insert(5);

    // console.log(fbs.zeroes().collect());


    // function* zeroes(bitset: FixedBitSet) {
    //     for (let i = 0; i < bitset.len(); i++) {
    //         if (!bitset.contains(i)) {
    //             yield i;
    //         }
    //     }
    // }
})