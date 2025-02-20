import { assert, describe, expect, it, test } from "vitest";
import { FixedBitSet } from "../src";
import { iter, range } from "joshkaposh-iterator";
import { trailing_zeros } from "../src/bit";
import { u32 } from "../src/Intrinsics";


test('remove', () => {
    const fbs = FixedBitSet.with_capacity(10);

    fbs.insert(5);
    assert(fbs.contains(5));
    fbs.remove(5);
    assert(!fbs.contains(5));
    assert(fbs.is_clear());
})

describe('put', () => {
    it('checks if bit exists', () => {
        const fbs = FixedBitSet.with_capacity(10000);
        assert(!fbs.put(5000));
        assert(fbs.put(5000));
        fbs.remove(5000);
        assert(!fbs.put(5000));
        assert(fbs.put(5000))

    })
})

describe('with_blocks', () => {
    it('works', () => {
        const fb = FixedBitSet.with_capacity_and_blocks(50, [8, 0])
        assert(fb.contains(3));
        assert(fb.ones().collect().length === 1)
        assert(fb.ones().rev().collect().length === 1);
    });

    it('blocks too small', () => {
        const fb = FixedBitSet.with_capacity_and_blocks(500, [8, 0])
        fb.insert(400);
        assert(fb.contains(400));
    });

    it('blocks too large', () => {
        const fb = FixedBitSet.with_capacity_and_blocks(1, [8]);
        assert(!fb.contains(3));
    })
})

describe('grow', () => {
    const len = 32 as number;
    it('grows to larger length', () => {
        const fb = FixedBitSet.with_capacity(len);
        assert(fb.length === len);
        fb.grow(100);
        assert(fb.length === 100);
    })

    it('grows to smaller length', () => {
        const fb = FixedBitSet.with_capacity(len);
        fb.insert(10);
        assert(fb.contains(10))
        fb.length = 10;
        assert(!fb.contains(10));
    })
})

test('toString', () => {
    const fbs = FixedBitSet.with_capacity(10);

    fbs.insert(5);
    fbs.insert(8);
    fbs.insert(3);

    assert(`${fbs}` === '0001010010');
})

describe('clone', () => {
    it('works', () => {
        const fbs = FixedBitSet.with_capacity(100);
        fbs.insert(5);
        fbs.insert(10);
        fbs.insert(7);

        const cloned = fbs.clone();
        assert(fbs.eq(cloned));
    })

    it('can clone from source `FixedBitSet`', () => {
        const fbs = FixedBitSet.with_capacity(100);
        const cloned = FixedBitSet.with_capacity(5);
        fbs.insert(5);
        fbs.insert(10);
        fbs.insert(7);

        fbs.clone_from(cloned);
        assert(fbs.eq(cloned));
    })
})

test('eq', () => {
    const fbs = FixedBitSet.with_capacity(50);
    const cloned = fbs.clone();

    assert(fbs.eq(cloned))

    fbs.insert(40);
    assert(!fbs.eq(cloned));

    fbs.remove(40);
    assert(fbs.eq(cloned));
})

describe('FixedBitSet can insert/toggle/remove ranges', () => {
    it('insert', () => {
        const fbs_a = FixedBitSet.with_capacity(1_000_000);
        console.time('insert_range a');
        fbs_a.insert_range(250_000, 500_000);
        console.timeEnd('insert_range a');

        console.time('remove_range')
        fbs_a.remove_range(250_000, 500_000)
        console.timeEnd('remove_range')
    })

    it('toggle', () => {
        const fbs = FixedBitSet.with_capacity(10_000);

        fbs.toggle_range(373, 690);
        assert(fbs.contains_all_in_range(373, 690))
        fbs.toggle_range(373, 690);
        assert(fbs.is_clear())
    })

    it('remove', () => {
        const fbs = FixedBitSet.with_capacity(10_000);

        fbs.insert_range(373, 690);
        assert(fbs.contains_all_in_range(373, 690))
        fbs.remove_range(373, 690);
        assert(fbs.is_clear())
    })
});

describe('FixedBitSet can count ones/zeroes', () => {
    const len = 10_000
    const fb = FixedBitSet.with_capacity(len);
    const ones_start = 1000;
    const ones_end = 2000;
    const ones_len = ones_end - ones_start;
    const zeroes_len = len - ones_len;

    fb.insert_range(ones_start, ones_end);

    it('ones', () => {
        assert(fb.count_ones() === ones_len);
    })

    it('zeroes', () => {
        assert(fb.count_zeroes() === zeroes_len);
    })
})

test('trailing_zeroes', () => {
    assert(trailing_zeros(0b0101000) === 3);
    assert(trailing_zeros(0b0100000) === 5);
    assert(trailing_zeros(0) === 32);
    assert(trailing_zeros(u32.MAX) === 0);
})

describe.concurrent('FixedBitSet implementss set theory', () => {
    it('intersection', () => {
        const len = 109;
        const a_end = 59;
        const b_start = 23;
        const a = FixedBitSet.with_capacity(len);
        const b = FixedBitSet.with_capacity(len);

        a.set_range(0, a_end, true);
        b.set_range(b_start, b.length, true);
        const count = a.intersection_count(b);
        const iterator_count = a.intersection(b).count();

        const ab = FixedBitSet.from_iter(a.intersection(b));

        for (let i = 0; i < b_start; i++) {
            assert(!ab.contains(i));
        }

        for (let i = b_start; i < a_end; i++) {
            assert(ab.contains(i))
        }

        for (let i = a_end; i < len; i++) {
            assert(!ab.contains(i));
        }

        a.intersect_with(b);

        ab.grow(a.length);

        assert(ab.eq(a));

        assert(ab.count_ones() === count);

        assert(count === iterator_count);
    })

    it('union', () => {
        const a_len = 173;
        const b_len = 137;

        const a_start = 139;
        const b_end = 107;

        const a = FixedBitSet.with_capacity(a_len);
        const b = FixedBitSet.with_capacity(b_len);

        a.set_range(a_start, a.length, true);
        b.set_range(0, b_end, true);

        const count = a.union_count(b);
        console.log('union count result', count);

        const iterator_count = a.union(b).count();

        const ab = FixedBitSet.from_iter(a.union(b));

        for (let i = a_start; i < a_len; i++) {
            assert(ab.contains(i));
        }

        for (let i = 0; i < b_end; i++) {
            assert(ab.contains(i));
        }

        for (let i = b_end; i < a_start; i++) {
            assert(!ab.contains(i));
        }

        a.union_with(b);

        assert(a.eq(ab));
        assert(count === ab.count_ones());

        assert(count === iterator_count);
    })

    it('difference', () => {
        const a_len = 83;
        const b_len = 151;
        const a_start = 0;
        const a_end = 79;
        const b_start = 53;

        const a = FixedBitSet.with_capacity(a_len);
        const b = FixedBitSet.with_capacity(b_len);

        a.set_range(a_start, a_end, true);
        b.set_range(b_start, b_len, true);

        const count = a.difference_count(b);
        const iterator_count = a.difference(b).count();

        const a_diff_b = FixedBitSet.from_iter(a.difference(b));
        for (let i = a_start; i < b_start; i++) {
            assert(a_diff_b.contains(i));
        }

        for (let i = b_start; i < b_len; i++) {
            assert(!a_diff_b.contains(i));
        }

        a.difference_with(b);
        a_diff_b.grow(a.length);

        assert(a_diff_b.eq(a));
        assert(a_diff_b.count_ones() === count);
        assert(count === iterator_count);
    })

    it('symmetric_difference', () => {
        const a_len = 83;
        const b_len = 151;
        const a_start = 47;
        const a_end = 79;
        const b_start = 53;

        const a = FixedBitSet.with_capacity(a_len);
        const b = FixedBitSet.with_capacity(b_len);

        a.set_range(a_start, a_end, true);
        b.set_range(b_start, b_len, true);

        const count = a.symmetric_difference_count(b);
        const iterator_count = a.symmetric_difference(b).count();

        const a_sym_diff_b = FixedBitSet.from_iter(a.symmetric_difference(b));

        for (let i = 0; i < a_start; i++) {
            assert(!a_sym_diff_b.contains(i))
        }

        for (let i = a_start; i < b_start; i++) {
            assert(a_sym_diff_b.contains(i))
        }

        for (let i = b_start; i < a_end; i++) {
            assert(!a_sym_diff_b.contains(i))
        }

        for (let i = a_end; i < b_len; i++) {
            assert(a_sym_diff_b.contains(i))
        }

        a.symmetric_difference_with(b);

        assert(a_sym_diff_b.eq(a));
        assert(a_sym_diff_b.count_ones() === count, `${a_sym_diff_b.count_ones()} !== ${count}`);
        assert(count === iterator_count);
    })
});

describe.concurrent('FixedBitSet implement bitwise operators', () => {
    it('bitor with equal lengths', () => {
        const len = 109;
        const a_start = 17;
        const a_end = 23;
        const b_start = 19;
        const b_end = 59;
        const a = FixedBitSet.with_capacity(len);
        const b = FixedBitSet.with_capacity(len);

        a.set_range(a_start, a_end, true);
        b.set_range(b_start, b_end, true);

        const ab = a.or(b);

        for (let i = 0; i < a_start; i++) {
            assert(!ab.contains(i));
        }

        for (let i = a_start; i < b_end; i++) {
            assert(ab.contains(i));
        }

        for (let i = b_end; i < len; i++) {
            assert(!ab.contains(i));
        }

        assert(ab.length === len);
    })

    it('bitor with first smaller', () => {
        const a_len = 113;
        const b_len = 137;
        const a_end = 89;
        const b_start = 97;
        const a = FixedBitSet.with_capacity(a_len);
        const b = FixedBitSet.with_capacity(b_len);
        a.set_range(0, a_end, true);
        b.set_range(b_start, b.length, true);
        let ab = a.or(b);

        range(0, a_end).for_each(i => assert(ab.contains(i)));
        range(a_end, b_start).for_each(i => assert(!ab.contains(i)));
        range(b_start, b_len).for_each(i => assert(ab.contains(i)))

        assert(b_len === ab.length);
    })

    it('bitor with first larger', () => {
        const a_len = 173;
        const b_len = 137;
        const a_start = 139;
        const b_end = 107;
        const a = FixedBitSet.with_capacity(a_len);
        const b = FixedBitSet.with_capacity(b_len);

        a.set_range(a_start, a.length, true)
        a.set_range(0, b_end, true);

        const ab = a.or(b);

        range(a_start, a_len).for_each(i => assert(ab.contains(i)));

        range(0, b_end).for_each(i => assert(ab.contains(i)));

        range(b_end, a_start).for_each(i => assert(!ab.contains(i)));

        assert(a_len === ab.length)
    })

    it('bitxor with equal lengths', () => {
        let len = 109;
        let a_end = 59;
        let b_start = 23;

        const a = FixedBitSet.with_capacity(len);
        const b = FixedBitSet.with_capacity(len);

        a.set_range(0, a_end, true);
        b.set_range(b_start, b.length, true);
        const ab = a.xor(b);

        range(0, b_start).for_each(i => assert(ab.contains(i)));
        range(b_start, a_end).for_each(i => assert(!ab.contains(i)));
        range(a_end, len).for_each(i => assert(ab.contains(i)));

        assert(a.length === ab.length);
    })

    it('bitxor with first smaller', () => {
        const a_len = 113;
        const b_len = 137;
        const len = Math.max(a_len, b_len);
        const a_end = 97;
        const b_start = 89;

        const a = FixedBitSet.with_capacity(a_len);
        const b = FixedBitSet.with_capacity(b_len);

        a.set_range(0, a_end, true);
        b.set_range(b_start, b.length, true);
        const ab = a.xor(b);

        range(0, b_start).for_each(i => assert(ab.contains(i)));
        range(b_start, a_end).for_each(i => assert(!ab.contains(i)));
        range(a_end, len).for_each(i => assert(ab.contains(i)));

        assert(b.length === ab.length);
    })

    it('bitxor with first larger', () => {
        const a_len = 173;
        const b_len = 137;
        const len = Math.max(a_len, b_len);
        const a_end = 107;
        const b_start = 43;

        const a = FixedBitSet.with_capacity(a_len);
        const b = FixedBitSet.with_capacity(b_len);

        a.set_range(0, a_end, true);
        b.set_range(b_start, b.length, true);
        const ab = a.xor(b);

        range(0, b_start).for_each(i => assert(ab.contains(i)));
        range(a_end, b_len).for_each(i => assert(ab.contains(i)));
        range(b_len, len).for_each(i => assert(!ab.contains(i)));

        assert(a.length === ab.length);
    })

    it('bitand assign with shorter', () => {
        const a_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
        const b_ones = [2, 7, 8, 11, 23, 31, 32]

        const a_and_b = [2, 7, 31, 32];
        const a = FixedBitSet.from_array(a_ones);
        const b = FixedBitSet.from_array(b_ones);

        a.and_with(b);

        const res = a.ones().collect();

        expect(res).toEqual(a_and_b)
    })

    it('bitand assign with longer', () => {
        const a_ones = [2, 7, 8, 11, 23, 31, 32];
        const b_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
        const a_and_b = [2, 7, 31, 32];

        const a = FixedBitSet.from_array(a_ones);
        const b = FixedBitSet.from_array(b_ones);

        a.and_with(b);
        const res = a.ones().collect();
        expect(res).toEqual(a_and_b);
    })

    it('bitor assign with shorter', () => {
        const a_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
        const b_ones = [2, 7, 8, 11, 23, 31, 32];
        const a_or_b = [2, 3, 7, 8, 11, 19, 23, 31, 32, 37, 41, 43, 47, 71, 73, 101];

        const a = FixedBitSet.from_array(a_ones);
        const b = FixedBitSet.from_array(b_ones);

        a.or_with(b);
        const res = a.ones().collect();
        expect(res).toEqual(a_or_b);
    })

    it('bitor assign with longer', () => {
        const a_ones = [2, 7, 8, 11, 23, 31, 32];
        const b_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
        const a_or_b = [2, 3, 7, 8, 11, 19, 23, 31, 32, 37, 41, 43, 47, 71, 73, 101];
        const a = FixedBitSet.from_array(a_ones);
        const b = FixedBitSet.from_array(b_ones);

        a.or_with(b);
        const res = a.ones().collect();
        expect(res).toEqual(a_or_b);
    })

    it('bitxor assign with shorter', () => {
        const a_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
        const b_ones = [2, 7, 8, 11, 23, 31, 32];
        const a_xor_b = [3, 8, 11, 19, 23, 37, 41, 43, 47, 71, 73, 101];
        const a = FixedBitSet.from_array(a_ones);
        const b = FixedBitSet.from_array(b_ones);
        a.xor_with(b)
        const res = a.ones().collect();
        expect(res).toEqual(a_xor_b);
    })

    it('bitxor assign with longer', () => {
        const a_ones = [2, 7, 8, 11, 23, 31, 32];
        const b_ones = [2, 3, 7, 19, 31, 32, 37, 41, 43, 47, 71, 73, 101];
        const a_xor_b = [3, 8, 11, 19, 23, 37, 41, 43, 47, 71, 73, 101];
        const a = FixedBitSet.from_array(a_ones);
        const b = FixedBitSet.from_array(b_ones);
        a.xor_with(b)
        const res = a.ones().collect();
        expect(res).toEqual(a_xor_b);
    })
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