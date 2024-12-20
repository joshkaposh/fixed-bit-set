import { test, expect, assert } from 'vitest'
import { FixedBitSet } from '../src'
import { iter, range } from 'joshkaposh-iterator';

// test('insert_range', () => {
//     const fbs = FixedBitSet.with_capacity(10);
//     fbs.insert_range();
//     expect(fbs.ones().collect()).toEqual([
//         0, 1, 2, 3, 4, 5, 6, 7, 8, 9
//     ])
//     fbs.clear();

//     fbs.grow(1000)
//     fbs.insert_range(range(100, 200));

//     for (let i = 100; i < 200; i++) {
//         assert(fbs.contains(i))
//     }

//     fbs.insert_range(range(400, 600))


//     for (let i = 0; i < 1000; i++) {
//         if (i < 100) {
//             assert(!fbs.contains(i))
//         } else if (i >= 100 && i < 200) {
//             assert(fbs.contains(i))
//         } else if (i >= 200 && i < 400) {
//             assert(!fbs.contains(i))
//         } else if (i >= 400 && i < 600) {
//             assert(fbs.contains(i))
//         } else {
//             assert(!fbs.contains(i))
//         }
//     }

//     fbs.grow(1_000_000);

//     fbs.clear();

//     fbs.insert_range(range(250_000, 500_000));

//     for (let i = 0; i < 1_000_000; i++) {
//         if (i < 250_000) {
//             assert(!fbs.contains(i))
//         } else if (i >= 250_000 && i < 500_000) {
//             assert(fbs.contains(i))
//         } else {
//             assert(!fbs.contains(i))
//         }
//     }
// })

test('it works', () => {
    // const fbs = FixedBitSet.with_capacity(10);
    // console.log(fbs.as_slice());
    // console.log(fbs.len(), fbs.block_len());
    // fbs.insert(9);

    // fbs.grow(11)
    // console.log(fbs.as_slice());
    // console.log(fbs.len(), fbs.block_len());
    // fbs.insert(10);
    // console.log(fbs.as_slice());

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
    assert(fbs.is_clear())
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
    // console.log(fbs.as_slice());
    fbs.insert_range(range(250, 500));
    // console.log(fbs.as_slice());

    const ones = fbs.ones();
    const zeroes = fbs.zeroes();
    assert(ones.all(b => b >= 250 && b < 500));

    // for (let i = 0; i < fbs.len(); i++) {
    //     console.log(zeroes.next().value);
    // }

    // assert(fbs.zeroes().all(b => b < 250 || b >= 500))
    // for (let i = 0; i < 500; i++) {
    //     (zeroes.next())
    // }
    // console.log('zeroes blocks', fbs.as_slice());

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
    let a = FixedBitSet.with_capacity(20)
    let b = FixedBitSet.with_capacity(20)
    a.insert_range(range(0, 10));
    b.insert_range(range(5, 20));

    expect(a.difference(b).collect()).toEqual([0, 1, 2, 3, 4]);
})

test('symmetric_difference', () => {
    let a = FixedBitSet.with_capacity(20)
    let b = FixedBitSet.with_capacity(20)
    a.insert_range(range(0, 15))
    b.insert_range(range(10, 20));

    expect(a.symmetric_difference(b).collect()).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 15, 16, 17, 18, 19])
})

test('intersection', () => {
    const a = FixedBitSet.with_capacity(21);
    const b = FixedBitSet.with_capacity(21);

    a.insert_range(range(0, 15));
    b.insert_range(range(8, 21))

    expect(a.intersection(b).collect()).toEqual(range(8, 15).collect())

})

test('union', () => {
    const a = FixedBitSet.with_capacity(10);
    const b = FixedBitSet.with_capacity(10);
    const expected = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    a.insert_range(range(0, 5))
    b.insert_range(range(5, 10));
    expect(a.union(b).collect()).toEqual(expected);
})