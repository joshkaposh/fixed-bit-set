import { done, DoubleEndedIterator, item, iter, Iterator, IterInputType } from "joshkaposh-iterator";
import { assert } from "joshkaposh-iterator/src/util";
import { count_ones, trailing_zeros } from "./bit";
import { u32 } from "./Intrinsics";
import { is_some, Option } from "joshkaposh-option";

const U32_COUNT = 4;
const BITS = U32_COUNT * 8 //* 32

function div_rem(x: number, d: number): [number, number] {
    return [Math.floor(x / d), Math.floor(x % d)];
}

export class FixedBitSet {
    #blocks: Uint32Array;
    #length: number;
    constructor(blocks = new Uint32Array(), length = 0) {
        this.#blocks = blocks;
        this.#length = length;
    }

    static with_capacity(bits: number) {
        let [blocks, rem] = div_rem(bits, BITS)
        blocks += Number(rem > 0);
        const arr = Uint32Array.from(Array.from({ length: blocks }, () => 0))
        return new FixedBitSet(arr, bits);
    }

    static with_capacity_and_blocks(bits: number, blocks: IterInputType<number>) {
        const bitset = this.with_capacity(bits);
        for (const [subblock, value] of iter(bitset.as_slice()).zip(blocks)) {
            // @ts-expect-error
            bitset.#set_unchecked(subblock, value)
        }
        return bitset;
    }

    static from_blocks_and_len(blocks: number[], length: number) {
        return new FixedBitSet(Uint32Array.from(blocks), length);
    }

    static from_iter(src: IterInputType<number>) {
        const fbs = FixedBitSet.with_capacity(0);
        fbs.extend(src);
        return fbs;
    }

    static from_array(src: number[]) {
        const fbs = FixedBitSet.with_capacity(0);
        fbs.extend_from_array(src);
        return fbs;
    }


    static default() {
        return FixedBitSet.with_capacity(0);
    }

    clone() {
        return new FixedBitSet(structuredClone(this.#blocks as Uint32Array<ArrayBuffer>), this.#length)
    }

    as_slice() {
        return this.#blocks;
    }

    /**
     * Resizes the bitset to the given amount of bits.
     * Does nothing if `bits` is less than current amount of bits in the bitset.
     */
    grow(bits: number) {
        function do_grow(fbs: FixedBitSet, bits: number) {
            fbs.#grow_inner(bits)
        }
        if (bits > this.#length) {
            do_grow(this, bits)

        }
    }

    grow_insert(bits: number) {
        this.grow(bits + 1);
        const [blocks, rem] = div_rem(bits, BITS)
        let b = this.#get_unchecked(blocks);
        b |= 1 << rem;
        this.#set_unchecked(blocks, b)
    }

    #grow_inner(bits: number) {
        let [blocks, rem] = div_rem(bits, BITS);
        blocks += Number(rem > 0);
        if (this.#blocks.length < blocks) {
            const buf = new ArrayBuffer(this.#blocks.length, { maxByteLength: BITS * blocks })
            buf.resize(blocks * U32_COUNT);
            const arr = new Uint32Array(buf);
            arr.set(this.#blocks);
            this.#blocks = arr;
            this.#length = bits;
        }
    }

    len() {
        return this.#length
    }

    block_len(): number {
        let [blocks, rem] = div_rem(this.#length, BITS)
        return blocks += Number(rem > 0);
    }

    /**
     * Checks if the bitset is empty.
     * If you want to check is all the bits are unset, use is_clear()
     */
    is_empty() {
        return this.#length === 0
    }

    /**
     * Checks if every bit is unset
     */
    is_clear() {
        for (let i = 0; i < this.#blocks.length; i++) {
            if (this.#blocks[i] !== 0) {
                return false
            }
        }
        return true;
    }

    /**
     * Checks if every bit is set
     */
    is_full() {
        return this.contains_all_in_range();
    }

    clear() {
        this.#blocks.fill(0, 0, this.#blocks.length);
    }

    count_ones(from = 0, to = this.#length) {
        return this.#batch_count_ones(from, to);
    }

    count_zeroes(from = 0, to = this.#length) {
        return this.#batch_count_zeroes(from, to);
    }

    insert_range(from = 0, to = this.#length) {
        const start = from;
        const end = to;
        assert(start <= end && end <= this.#length, `Invalid range ${start}..${end} for a fixedbitset of size ${this.#length}`)
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        for (let i = from; i < to; i++) {
            let res: [number, number];
            if (first_block < last_block) {
                res = [first_block, first_mask] as [number, number];
                first_block += 1;
                first_mask = ~0;
            } else if (first_block === last_block) {
                const mask = first_mask & last_mask;
                if (mask === 0) {
                    break;
                }
                res = [first_block, mask]
                first_block += 1;
            } else {
                break;
            }
            const [block, mask] = res;
            let b = this.#get_unchecked(block);
            b |= mask;
            this.#set_unchecked(block, b);
        }
    }

    remove_range(from = 0, to = this.#length) {
        const start = from;
        const end = to;
        assert(start <= end && end <= this.#length, `Invalid range ${start}..${end} for a fixedbitset of size ${this.#length}`)
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        for (let i = from; i < to; i++) {
            let res: [number, number];
            if (first_block < last_block) {
                res = [first_block, first_mask] as [number, number];
                first_block += 1;
                first_mask = ~0;
            } else if (first_block === last_block) {
                const mask = first_mask & last_mask;
                if (mask === 0) {
                    break;
                }
                res = [first_block, mask]
                first_block += 1;
            } else {
                break;
            }
            const [block, mask] = res;
            let b = this.#get_unchecked(block);
            b &= ~mask;
            this.#set_unchecked(block, b);

        }
    }

    toggle_range(from = 0, to = this.#length) {
        const start = from;
        const end = to;
        assert(start <= end && end <= this.#length, `Invalid range ${start}..${end} for a fixedbitset of size ${this.#length}`)
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        for (let i = from; i < to; i++) {
            let res: [number, number];
            if (first_block < last_block) {
                res = [first_block, first_mask] as [number, number];
                first_block += 1;
                first_mask = ~0;
            } else if (first_block === last_block) {
                const mask = first_mask & last_mask;
                if (mask === 0) {
                    break;
                }
                res = [first_block, mask]
                first_block += 1;
            } else {
                break;
            }
            const [block, mask] = res;
            let b = this.#get_unchecked(block);
            b ^= mask;
            this.#set_unchecked(block, b);
        }
    }

    set_range(from: number, to: number, enabled: boolean | 0 | 1) {
        if (enabled) {
            this.insert_range(from, to);
        } else {
            this.remove_range(from, to);
        }
    }

    insert(bit: number) {
        assert(bit < this.#length);
        this.insert_unchecked(bit);
    }

    insert_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS)
        this.#blocks[block] |= 1 << i;
    }

    contains(bit: number) {
        if (bit < this.#length) {
            return this.contains_unchecked(bit)
        }
        return false;
    }

    contains_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS)
        return (this.#get_unchecked(block) & (1 << i)) !== 0;
    }

    contains_any_in_range(from = 0, to = this.#length) {
        const start = from;
        const end = to;
        assert(start <= end && end <= this.#length, `Invalid range ${start}..${end} for a fixedbitset of size ${this.#length}`)
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        for (let i = from; i < to; i++) {
            let res: [number, number];
            if (first_block < last_block) {
                res = [first_block, first_mask] as [number, number];
                first_block += 1;
                first_mask = ~0;
            } else if (first_block === last_block) {
                const mask = first_mask & last_mask;
                if (mask === 0) {
                    break;
                }
                res = [first_block, mask]
                first_block += 1;
            } else {
                break;
            }
            const [block, mask] = res;
            let b = this.#get_unchecked(block);
            if ((b & mask) !== 0) {
                return true
            }
        }

        return false;
    }

    contains_all_in_range(from = 0, to = this.#length) {
        const start = from;
        const end = to;
        assert(start <= end && end <= this.#length, `Invalid range ${start}..${end} for a fixedbitset of size ${this.#length}`)
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        for (let i = from; i < to; i++) {
            let res: [number, number];
            if (first_block < last_block) {
                res = [first_block, first_mask] as [number, number];
                first_block += 1;
                first_mask = ~0;
            } else if (first_block === last_block) {
                const mask = first_mask & last_mask;
                if (mask === 0) {
                    break;
                }
                res = [first_block, mask]
                first_block += 1;
            } else {
                break;
            }
            const [block, mask] = res;
            let b = this.#get_unchecked(block);
            if ((b & mask) !== mask) {
                return false
            }
        }
        return true;
    }

    remove(bit: number) {
        assert(bit < this.#length)
        this.remove_unchecked(bit);
    }

    remove_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS)
        this.#set_unchecked(block, block & ~(1 << i))
    }

    put(bit: number): boolean {
        assert(bit < this.#length);
        return this.put_unchecked(bit);
    }

    put_unchecked(bit: number): boolean {
        const [block, i] = div_rem(bit, BITS)
        let word = this.#get_unchecked(block);
        const prev = (word & (1 << i)) !== 0;
        word |= 1 << i;
        this.#set_unchecked(block, word);
        return prev;

    }

    toggle(bit: number) {
        assert(bit < this.#length)
        this.toggle_unchecked(bit)
    }

    toggle_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS);
        let b = this.#get_unchecked(block);
        b ^= 1 << i;
        this.#set_unchecked(block, b)
    }

    set(bit: number, enabled: 0 | 1 | boolean) {
        assert(bit < this.#length)
        this.set_unchecked(bit, enabled);
    }

    set_unchecked(bit: number, enabled: 0 | 1 | boolean) {
        const [block, i] = div_rem(bit, BITS)
        let elt = this.#get_unchecked(block);
        if (enabled) {
            elt |= 1 << i;
        } else {
            elt &= ~(1 << i);
        }
        this.#set_unchecked(block, elt);
    }

    copy_bit(from: number, to: number) {
        assert(to < this.#length)
        const enabled = this.contains(from);
        this.set_unchecked(to, enabled);
    }

    copy_bit_unchecked(from: number, to: number) {
        const enabled = this.contains_unchecked(from);
        this.set_unchecked(to, enabled);
    }

    ones() {
        const first = split_first(this.as_slice());
        if (first) {
            const [first_block, rem_] = first;
            const [last_block, rem] = split_last(rem_) ?? [0, rem_]
            return new Ones(
                first_block,
                last_block,
                0,
                (1 + rem.length) * BITS,
                iter(rem)
            )
        } else {
            return new Ones(
                0,
                0,
                0,
                0,
                iter([])
            )
        }
    }

    zeroes() {
        const split = split_first(this.#blocks);
        if (split) {
            const [block, rem] = split;
            return new Zeroes(
                ~block,
                0,
                this.len(),
                iter(rem)
            )
        } else {
            return new Zeroes(
                ~0,
                0,
                this.len(),
                iter([])
            )
        }
    }

    and(other: FixedBitSet) {
        const l = other.len()
        for (let i = 0; i < l; i++) {
            if (!is_some(this.#blocks[i])) {
                break;
            }
            this.#blocks[i] &= other.#blocks[i]
        }
    }

    /**
     * Performs an in-place bitwise or between `this`  and `other`.
     */
    or(other: FixedBitSet) {
        const len = other.len()
        if (this.#blocks.length < len) {
            this.grow(len);
        }
        for (let i = 0; i < len; i++) {
            this.#blocks[i] |= other.#blocks[i]
        }
    }

    /**
     * Performs an in-place bitwise xor between `this`  and `other`.
     */
    xor(other: FixedBitSet) {
        const len = other.len()
        if (this.#blocks.length < len) {
            this.grow(len);
        }
        for (let i = 0; i < len; i++) {
            this.#blocks[i] ^= other.#blocks[i]
        }
    }

    /**
     * Checks if `this` and `other`'s bits exactly equal each other.
     */
    eq(other: FixedBitSet) {
        for (let i = 0; i < this.#blocks.length; i++) {
            if (!is_some(other.#blocks[i]) || this.#blocks[i] !== other.#blocks[i]) {
                return false;
            }
        }
        return true
    }

    extend(src: IterInputType<number>) {
        const it = iter(src)
        for (const i of it) {
            if (i >= this.len()) {
                this.grow(i + 1)
            }
            this.put(i);
        }
    }

    extend_from_array(src: number[]) {
        for (let index = 0; index < src.length; index++) {
            const i = src[index];
            if (i >= this.len()) {
                this.grow(i + 1)
            }
            this.put(i);
        }
    }



    intersection(other: FixedBitSet): DoubleEndedIterator<number> {
        return new Intersection(this.ones(), other)
    }

    /**
     * in-place intersection of two 'FixedBitSet's
     * 'self's capacity will remain the same
     */
    intersect_with(other: FixedBitSet) {
        const l = this.#blocks.length;
        for (let i = 0; i < l; i++) {
            this.#blocks[i] &= other.#blocks[i];
        }
        let mn = Math.min(this.#blocks.length, other.#blocks.length);
        for (let i = mn; i < this.#blocks.length; i++) {
            this.#blocks[i] = 0;
        }
    }

    /**
     * A union of `FixedBitSet` A and `FixedBitSet` B
     * is equal to the ones that both A and B contain
     */
    union(other: FixedBitSet) {
        return new Union(this.ones().chain(other.difference(this)))
    }

    union_with(other: FixedBitSet) {
        if (other.len() >= this.len()) {
            this.grow(other.len())
        }
        for (let i = 0; i < this.len(); i++) {
            const y = other.as_slice()[i];
            this.#blocks[i] |= y
        }
    }

    difference(other: FixedBitSet): DoubleEndedIterator<number> {
        return new Difference(this.ones(), other);
    }

    /**
     * in-place difference of two 'FixedBitSet's
     * 'self's capacity will remain the same
     */
    difference_with(other: FixedBitSet) {
        const l = this.#blocks.length;
        for (let i = 0; i < l; i++) {
            this.#blocks[i] &= ~other.#blocks[i] as unknown as number;
        }
    }


    symmetric_difference(other: FixedBitSet) {
        return this.difference(other).chain(other.difference(this))
    }

    // in-place symmetric difference of two 'FixedBitSet's;
    // 'self's capacity may be increased to match 'other's
    symmetric_difference_with(other: FixedBitSet) {
        if (other.len() >= this.len()) {
            this.grow(other.len())
        }
        const m = Math.max(this.#blocks.length, other.#blocks.length)
        for (let i = 0; i < m; i++) {
            this.#blocks[i] ^= other.#blocks[i];
        }
    }

    // returns 'true' if 'self' has no elements in common with 'other'
    is_disjoint(other: FixedBitSet): boolean {
        return iter(this.#blocks)
            .zip(iter(other.as_slice()))
            .all(([x, y]) => (x & y) === 0)
    }

    is_subset(other: FixedBitSet): boolean {
        return iter(this.#blocks)
            .zip(iter(other.as_slice()))
            .all(([x, y]) => (x & ~y) === 0)
            && iter(this.#blocks).skip(other.as_slice().length).all(x => x === 0)
    }

    is_superset(other: FixedBitSet) {
        return other.is_subset(this)
    }

    format(type: 'b' | '#b' = 'b') {
        let bstring = type === '#b' ? '0b' : '';
        for (let i = 0; i < this.len(); i++) {
            bstring += Number(this.contains(i)) * 1;
        }
        return bstring;
    }

    toString(type?: '#') {
        if (!type) {
            return this.format()
        }
        return this.format('#b')
    }

    [Symbol.iterator]() {
        return this.ones();
    }


    #get_unchecked(subblock: number) {
        return this.#blocks[subblock];
    }

    #set_unchecked(subblock: number, bits: number) {
        this.#blocks[subblock] = bits;
    }

    #batch_count_ones(from: number, to: number) {
        const start = from;
        const end = to;
        assert(start <= end && end <= this.#length, `Invalid range ${start}..${end} for a fixedbitset of size ${this.#length}`)
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        let ones_count = 0;

        for (let i = from; i < to; i++) {
            let res: [number, number];
            if (first_block < last_block) {
                res = [first_block, first_mask] as [number, number];
                first_block += 1;
                first_mask = ~0;
            } else if (first_block === last_block) {
                const mask = first_mask & last_mask;
                if (mask === 0) {
                    break;
                }
                res = [first_block, mask]
                first_block += 1;
            } else {
                break;
            }
            const [block, mask] = res;
            let b = this.#get_unchecked(block) & mask;
            ones_count += count_ones(b);
        }
        return ones_count;
    }

    #batch_count_zeroes(from: number, to: number) {
        const start = from;
        const end = to;
        assert(start <= end && end <= this.#length, `Invalid range ${start}..${end} for a fixedbitset of size ${this.#length}`)
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        let ones_count = 0;

        for (let i = from; i < to; i++) {
            let res: [number, number];
            if (first_block < last_block) {
                res = [first_block, first_mask] as [number, number];
                first_block += 1;
                first_mask = ~0;
            } else if (first_block === last_block) {
                const mask = first_mask & last_mask;
                if (mask === 0) {
                    break;
                }
                res = [first_block, mask]
                first_block += 1;
            } else {
                break;
            }
            const [block, mask] = res;
            let b = ~this.#get_unchecked(block) & mask;
            ones_count += count_ones(b);
        }
        return ones_count;
    }



}
class Ones extends DoubleEndedIterator<number> {
    #bitset_front: number;
    #bitset_back: number;
    #block_idx_front: number;
    #block_idx_back: number;
    #remaining_blocks: DoubleEndedIterator<number>

    constructor(bitset_front: number, bitset_back: number, front_block_index: number, back_block_index: number, remaining_blocks: DoubleEndedIterator<number>) {
        super()
        this.#bitset_front = bitset_front;
        this.#bitset_back = bitset_back;
        this.#block_idx_front = front_block_index
        this.#block_idx_back = back_block_index;
        this.#remaining_blocks = remaining_blocks;
    }

    clone(): Ones {
        return new Ones(this.#bitset_front, this.#bitset_back, this.#block_idx_front, this.#block_idx_back, this.#remaining_blocks.clone())
    }

    into_iter(): DoubleEndedIterator<number> {
        this.#remaining_blocks.into_iter();
        return this;
    }

    override next(): IteratorResult<number> {
        while (this.#bitset_front === 0) {
            const block = this.#remaining_blocks.next();
            if (!block.done) {
                this.#bitset_front = block.value;
                this.#block_idx_front += BITS;
            } else {
                // check back
                if (this.#bitset_back !== 0) {
                    this.#block_idx_front = this.#block_idx_back;
                    this.#bitset_front = 0;
                    const [bitset_back, position] = this.#last_positive_bit_and_unset(this.#bitset_back)
                    this.#bitset_back = bitset_back
                    return item(this.#block_idx_back + position)

                } else {
                    return done();

                }

            }

        }
        const [bitset_front, position] = this.#last_positive_bit_and_unset(this.#bitset_front)
        this.#bitset_front = bitset_front;
        return item(this.#block_idx_front + position)

    }

    override next_back(): IteratorResult<number> {
        while (this.#bitset_back === 0) {
            const block = this.#remaining_blocks.next_back();
            if (block.done) {
                if (this.#bitset_front !== 0) {
                    this.#bitset_back = 0;
                    this.#block_idx_back = this.#block_idx_front;
                    const [bitset_front, position] = this.#first_positive_bit_and_unset(this.#bitset_front)
                    this.#bitset_front = bitset_front

                    return item(this.#block_idx_front + BITS - position - 1)
                } else {
                    return done();
                }
            } else {
                this.#bitset_back = block.value;
                this.#block_idx_back -= BITS;
            }
        }

        const [bitset_back, position] = this.#first_positive_bit_and_unset(this.#bitset_back)
        this.#bitset_back = bitset_back;
        return item(position)
    }

    size_hint(): [number, Option<number>] {
        return [0, this.#block_idx_back - this.#block_idx_front + 2 * BITS]
    }

    #last_positive_bit_and_unset(n: number): [new_number: number, bit_idx: number] {
        const last_bit = n & -n;
        const position = trailing_zeros(last_bit);

        return [n &= n - 1, position];
    }

    #first_positive_bit_and_unset(n: number): [new_number: number, bit_idx: number] {
        const bit_idx = Math.clz32(n);
        const mask = ~((1) << (BITS - bit_idx - 1))
        return [n &= mask, bit_idx];
    }
}

class Zeroes extends Iterator<number> {
    #bitset: number;
    #block_idx: number;
    #len: number;
    #remaining_blocks: Iterator<number>;

    constructor(bitset: number, block_idx: number, len: number, remaining_blocks: Iterator<number>) {
        super()
        this.#bitset = bitset;
        this.#block_idx = block_idx;
        this.#len = len;
        this.#remaining_blocks = remaining_blocks
    }

    into_iter(): Iterator<number> {
        return this;
    }

    next(): IteratorResult<number, any> {
        while (this.#bitset === 0) {
            const n = this.#remaining_blocks.next();
            if (n.done) return done();
            this.#bitset = ~n.value;
            this.#block_idx += BITS;
        }

        const t = this.#bitset & (0 - this.#bitset);
        const r = trailing_zeros(this.#bitset);
        this.#bitset ^= t;

        const bit = this.#block_idx + r;

        if (bit < this.#len) {
            return item(bit)
        }

        return done();
    }

    size_hint(): [number, Option<number>] {
        return [0, this.#len]
    }
}


class Difference extends DoubleEndedIterator<number> {
    #iter: DoubleEndedIterator<number>;
    #other: FixedBitSet;
    constructor(iter: DoubleEndedIterator<number>, other: FixedBitSet) {
        super()
        this.#iter = iter;
        this.#other = other;
    }

    clone() {
        return new Difference(this.#iter.clone(), this.#other.clone());
    }

    override into_iter(): DoubleEndedIterator<number> {
        this.#iter.into_iter();
        return this
    }

    override next(): IteratorResult<number> {
        const f = this.#iter.find(nxt => !this.#other.contains(nxt));
        return is_some(f) ? item(f) : done();
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint();
    }

    next_back(): IteratorResult<number, any> {
        const n = this.#iter.next_back();
        return (!n.done && !this.#other.contains(n.value)) ?
            item(n.value) : done();
    }

}

class Intersection extends DoubleEndedIterator<number> {
    #iter: DoubleEndedIterator<number>;
    #other: FixedBitSet;
    constructor(iter: DoubleEndedIterator<number>, other: FixedBitSet) {
        super()
        this.#iter = iter;
        this.#other = other
    }

    clone(): Intersection {
        return new Intersection(this.#iter.clone(), this.#other.clone())
    }

    override into_iter(): DoubleEndedIterator<number> {
        this.#iter.into_iter()
        return this;
    }

    override next(): IteratorResult<number> {
        const n = this.#iter.find(nxt => this.#other.contains(nxt));
        return is_some(n) ? item(n) : done()
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint()
    }

    next_back(): IteratorResult<number, any> {
        const n = this.#iter.rfind(nxt => this.#other.contains(nxt));
        return is_some(n) ? item(n) : done()
    }

}

class Union extends DoubleEndedIterator<number> {
    #iter: DoubleEndedIterator<number>;
    constructor(iter: DoubleEndedIterator<number>) {
        super();
        this.#iter = iter;
    }

    clone(): Union {
        return new Union(this.#iter.clone());
    }

    override into_iter(): DoubleEndedIterator<number> {
        this.#iter.into_iter()
        return this;
    }
    override next(): IteratorResult<number> {
        return this.#iter.next();
    }

    next_back(): IteratorResult<number, any> {
        return this.#iter.next_back();
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint()
    }

}

type AnyArray = Array<number> | Uint8Array | Uint16Array | Uint32Array;

function split_first<A extends AnyArray>(array: A): Option<[number, A]> {
    if (array.length > 0) {
        return [array[0], array.slice(1, array.length) as A]
    }
    return;
}

function split_last<A extends AnyArray>(array: A): Option<[number, A]> {
    if (array.length > 0) {
        return [array[array.length - 1], array.slice(0, array.length - 1) as A]
    }
    return;
}