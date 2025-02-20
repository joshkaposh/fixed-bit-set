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
    private constructor(blocks = new Uint32Array(), length = 0) {
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

        const blocks_iter = iter(blocks);
        const inner_blocks = bitset.#blocks;

        for (let i = 0; i < inner_blocks.length; i++) {
            const value = blocks_iter.next().value;
            inner_blocks[i] = value;
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


    /**
     * @returns the total number of bits this bitset has.
     */
    get length() {
        return this.#length
    }

    /**
     * Sets the total length of the bitset to `bits`.
     */
    set length(bits) {
        if (bits >= 0) {
            this.#grow_inner(bits);
        }
    }

    get block_length(): number {
        let [blocks, rem] = div_rem(this.#length, BITS)
        return blocks += Number(rem > 0);
    }

    toArray() {
        return Array.from(this.#blocks);
    }

    /**
     * Checks if `this` and `other`'s bits exactly equal each other.
     */
    eq(other: FixedBitSet) {
        return this.#blocks.every((b, i) => b === other.#blocks[i])
    }

    clone() {
        return FixedBitSet.from_blocks_and_len(Array.from(this.#blocks), this.#length)
    }

    /**
     * Performs copy-assigment from `src`.
     * 
     * `a.clone_from(b)` is equivalent to `a = b.clone()` in functionality.
     */
    clone_from(src: FixedBitSet) {
        if (this.#length < src.#length) {
            this.#grow_inner(src.#length);
        }

        // const me = this.#length;
        // const them = src.#length;

        this.#blocks = structuredClone(src.#blocks);

        this.#length = src.#length;
    }


    /**
     * Resizes the bitset to the given amount of bits.
     * Does nothing if `bits` is less than current amount of bits in the bitset.
     */
    grow(bits: number) {
        if (bits > this.#length) {
            this.#grow_inner(bits)
        }
    }

    /**
     * Grows the internal size of the bitset before inserting a bit.
     * 
     * Unlike `insert()`, this cannot throw, but may allocate if the bit is outside of the existing buffer's range.
     * 
     * This is faster than calling `grow()` then `insert()` in succession.
     */
    grow_insert(bits: number) {
        this.grow(bits + 1);
        const [block, rem] = div_rem(bits, BITS)
        this.#blocks[block] |= 1 << rem;
    }

    #grow_inner(bits: number) {
        let [blocks, rem] = div_rem(bits, BITS);
        blocks += Number(rem > 0);
        // if (this.#blocks.length < bits) {
        const buf = new ArrayBuffer(this.#blocks.length, { maxByteLength: BITS * blocks })
        buf.resize(blocks * U32_COUNT);
        const arr = new Uint32Array(buf);
        arr.set(this.#blocks);
        this.#blocks = arr;
        this.#length = bits;
        // }
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

    /**
     * Clears the bitset, setting all bits to 0.
     * 
     * This does not change the bitset length.
     */
    clear() {
        this.#blocks.fill(0);
    }

    /**
     * @returns the number of ones set in this FixBitSet
     * @throws if `from >= to` and if `to > length`.
     */
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
            this.#blocks[block] |= mask;
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
            this.#blocks[block] &= ~mask;
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
            this.#blocks[block] ^= mask;
        }
    }

    set_range(from: number, to: number, enabled: boolean | 0 | 1) {
        if (enabled) {
            this.insert_range(from, to);
        } else {
            this.remove_range(from, to);
        }
    }

    /**
     * Enable `bit`
     * 
     * @throws if `bit >= length`
     */
    insert(bit: number) {
        assert(bit < this.#length, `Cannot insert bit ${bit} >= FixedBitSet length ${this.#length}`);
        this.insert_unchecked(bit);
    }

    insert_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS)
        this.#blocks[block] |= 1 << i;
    }

    /**
     * 
     * @returns true if the `bit` is enabled.
     */
    contains(bit: number) {
        if (bit < this.#length) {
            return this.contains_unchecked(bit)
        }
        return false;
    }

    contains_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS)
        return (this.#blocks[block] & (1 << i)) !== 0;
    }

    /**
     * @returns true if fixedbitset has **any** bits set in the given range.
     */
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
            if ((this.#blocks[block] & mask) !== 0) {
                return true
            }
        }

        return false;
    }

    /**
     * @returns true if fixedbitset has **all** bits set in the given range.
     */
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
            if ((this.#blocks[block] & mask) !== mask) {
                return false
            }
        }
        return true;
    }

    /**
     * Sets the bit at the index `bit`, to `0`, if it exists.
     * 
     * @throws if `bit >= length`.
     */
    remove(bit: number) {
        assert(bit < this.#length, `Cannot remove bit ${bit} >= FixedBitSet length ${this.#length}`)
        this.remove_unchecked(bit);
    }

    remove_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS);
        this.#blocks[block] &= ~(1 << i);
    }

    /**
     * @returns true if there was a `bit` present before inserting `bit`.
     * 
     * @throws if `bit >= length`
     */
    put(bit: number): boolean {
        assert(bit < this.#length, `put at index ${bit} exceeds fixedbitset size ${this.#length}`);
        return this.put_unchecked(bit);
    }

    put_unchecked(bit: number): boolean {
        const [block, i] = div_rem(bit, BITS);

        let word = this.#blocks[block];
        const prev = (word & (1 << i)) !== 0;
        word |= 1 << i;
        this.#blocks[block] = word;
        return prev;

    }

    /**
     * Toggle `bit`, inverting its state.
     * 
     * @throws if `bit >= length`.
     */
    toggle(bit: number) {
        assert(bit < this.#length, `toggle at index ${bit} exceeds fixedbitset size ${this.#length}`);
        this.toggle_unchecked(bit)
    }

    toggle_unchecked(bit: number) {
        const [block, i] = div_rem(bit, BITS);
        this.#blocks[block] ^= 1 << i;
    }

    /**
     * sets the bit to the provided `enabled` value.
     * 
     * @throws if `bit >= length`.
     */
    set(bit: number, enabled: 0 | 1 | boolean) {
        assert(bit < this.#length, `set at index ${bit} exceeds fixedbitset size ${this.#length}`);
        this.set_unchecked(bit, enabled);
    }

    set_unchecked(bit: number, enabled: 0 | 1 | boolean) {
        const [block, i] = div_rem(bit, BITS)
        let elt = this.#blocks[block];
        if (enabled) {
            elt |= 1 << i;
        } else {
            elt &= ~(1 << i);
        }
        this.#blocks[block] = elt;
    }

    /**
     * Copies the bit at index `from` to the index `to`.
     */
    copy_bit(from: number, to: number) {
        assert(to < this.#length, `copy to index ${to} exceeds fixedbitset size ${this.#length}`);
        const enabled = this.contains(from);
        this.set_unchecked(to, enabled);
    }

    copy_bit_unchecked(from: number, to: number) {
        const enabled = this.contains_unchecked(from);
        this.set_unchecked(to, enabled);
    }

    ones() {
        const first = split_first(this.#blocks);
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
                this.length,
                iter(rem)
            )
        } else {
            return new Zeroes(
                ~0,
                0,
                this.length,
                iter([])
            )
        }
    }


    /**
     * Performs an immutable bitwise and between `this` and `other`
     * 
     * @returns a new `FixedBitSet`
     */
    and(other: FixedBitSet) {
        const [short, long] = this.#length <= other.#length ? [this.#blocks, other.#blocks] : [other.#blocks, this.#blocks];

        const data = Array.from(short);

        for (let i = 0; i < data.length; i++) {
            data[i] &= long[i];
        }

        return FixedBitSet.from_blocks_and_len(data, Math.max(this.#length, other.#length))
    }


    /**
     * Performs an in-place bitwise and between `this`  and `other`.
     * 
     * @returns the same `FixedBitset` this method was called with
     */
    and_with(other: FixedBitSet) {
        this.intersect_with(other);
        return this;
    }


    /**
     * Performs an immutable bitwise or between `this` and `other`
     * 
     * @returns a new `FixedBitSet`
     */
    or(other: FixedBitSet) {
        const [short, long] = this.#length <= other.#length ? [this.#blocks, other.#blocks] : [other.#blocks, this.#blocks]

        const data = Array.from(long);
        for (let i = 0; i < data.length; i++) {
            data[i] |= short[i];
        }

        return FixedBitSet.from_blocks_and_len(data, Math.max(this.#length, other.#length));
    }

    /**
     * Performs an in-place bitwise or between `this`  and `other`.
     * 
     * @returns the same `FixedBitset` this method was called with
     */
    or_with(other: FixedBitSet) {
        this.union_with(other);
        return this;
    }


    /**
     * Performs an immutable bitwise xor between `this` and `other`
     * 
     * @returns a new `FixedBitSet`
     */
    xor(other: FixedBitSet) {
        const [short, long] = this.#length <= other.#length ? [this.#blocks, other.#blocks] : [other.#blocks, this.#blocks];
        const data = Array.from(long);
        for (let i = 0; i < data.length; i++) {
            data[i] ^= short[i];
        }

        return FixedBitSet.from_blocks_and_len(data, Math.max(this.#length, other.#length));
    }

    /**
     * Performs an in-place bitwise xor between `this`  and `other`.
     * 
     * @returns the same `FixedBitset` this method was called with
     */
    xor_with(other: FixedBitSet) {
        this.symmetric_difference_with(other);
        return this;
    }

    extend(src: IterInputType<number>) {
        const it = iter(src);
        for (const i of it) {
            if (i >= this.#length) {
                this.grow(i + 1)
            }
            this.put(i);
        }
    }

    extend_from_array(src: number[]) {
        for (let index = 0; index < src.length; index++) {
            const i = src[index];
            if (i >= this.#length) {
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
        return this.ones().chain(other.difference(this));
        // return new Union(this.ones().chain(other.difference(this)))
    }

    /**
     * In-place union of two `FixedBitSet`s
     * 
     * This method mutates the `FixedBitSet` that `union_with` is called on.
     */
    union_with(other: FixedBitSet) {
        if (other.#length >= this.#length) {
            this.grow(other.#length)
        }

        for (let i = 0; i < this.#length; i++) {
            const y = other.#blocks[i];
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
        if (other.#length >= this.#length) {
            this.grow(other.#length)
        }
        const m = Math.max(this.#blocks.length, other.#blocks.length)
        for (let i = 0; i < m; i++) {
            this.#blocks[i] ^= other.#blocks[i];
        }
    }

    union_count(other: FixedBitSet) {
        const start = 0;
        const end = this.#length;

        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        let count = 0;
        let from = 0;
        let to = this.#length;
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

            count += count_ones((this.#blocks[block] & mask) | (other.#blocks[block] & mask))
        }


        return count;

    }

    intersection_count(other: FixedBitSet) {
        const start = 0;
        const end = this.#length;
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)


        let count = 0;
        let from = 0;
        let to = this.#length;
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
            count += count_ones((this.#blocks[block] & mask) & (other.#blocks[block] & mask));
        }
        return count;
    }

    difference_count(other: FixedBitSet) {
        const start = 0;
        const end = this.#length;

        let count = 0;
        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)


        let from = 0;
        let to = this.#length;
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

            count += count_ones((this.#blocks[block] & mask) & ~(other.#blocks[block] & mask))
        }

        return count;
    }

    symmetric_difference_count(other: FixedBitSet) {
        const start = 0;
        const end = this.#length;

        const [first_block_, first_rem_] = div_rem(start, BITS)
        const [last_block_, last_rem_] = div_rem(end, BITS)

        let first_block = first_block_;
        let first_mask = u32.MAX << first_rem_;
        let last_block = last_block_;
        let last_mask = (u32.MAX >>> 1) >>> (BITS - last_rem_ - 1)

        let count = 0;
        let from = 0;
        let to = this.#length;

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

            count += count_ones((this.#blocks[block] & mask) ^ (other.#blocks[block] & mask))
        }

        if (other.#length > this.#length) {
            console.log('>');
            return count + other.#batch_count_ones(this.#length)
        } else if (other.#length < this.#length) {
            return count + this.#batch_count_ones(other.#length)
        } else {
            console.log('===');
            return count;
        }
    }

    // returns 'true' if 'self' has no elements in common with 'other'
    is_disjoint(other: FixedBitSet): boolean {
        return iter(this.#blocks)
            .zip(iter(other.#blocks))
            .all(([x, y]) => (x & y) === 0)
    }

    is_subset(other: FixedBitSet): boolean {
        return iter(this.#blocks)
            .zip(iter(other.#blocks))
            .all(([x, y]) => (x & ~y) === 0)
            && iter(this.#blocks).skip(other.#blocks.length).all(x => x === 0)
    }

    is_superset(other: FixedBitSet) {
        return other.is_subset(this)
    }

    format(type: 'b' | '#b' = 'b') {
        let bstring = type === '#b' ? '0b' : '';
        for (let i = 0; i < this.#length; i++) {
            bstring += Number(this.contains(i));
        }
        return bstring;
    }

    toString(type?: '#') {
        const ty = !type ? 'b' : '#b';
        return this.format(ty)
    }

    [Symbol.toStringTag]() {
        return this.toString();
    }

    [Symbol.toPrimitive]() {
        return this.toString();
    }

    [Symbol.iterator]() {
        return this.ones();
    }

    #batch_count_ones(from?: number, to?: number) {
        from ??= 0
        to ??= this.#length;
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
            ones_count += count_ones(this.#blocks[block] & mask);
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
            ones_count += count_ones(~this.#blocks[block] & mask);
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
        return n != null ? item(n) : done();
    }

    size_hint(): [number, Option<number>] {
        return this.#iter.size_hint()
    }

    next_back(): IteratorResult<number, any> {
        const n = this.#iter.rev().find(nxt => this.#other.contains(nxt));
        return n != null ? item(n) : done();
    }

}

// class Union extends DoubleEndedIterator<number> {
//     #iter: DoubleEndedIterator<number>;
//     constructor(iter: DoubleEndedIterator<number>) {
//         super();
//         this.#iter = iter;
//     }

//     clone(): Union {
//         return new Union(this.#iter.clone());
//     }

//     override into_iter(): DoubleEndedIterator<number> {
//         this.#iter.into_iter()
//         return this;
//     }
//     override next(): IteratorResult<number> {
//         return this.#iter.next();
//     }

//     next_back(): IteratorResult<number, any> {
//         return this.#iter.next_back();
//     }

//     size_hint(): [number, Option<number>] {
//         return this.#iter.size_hint()
//     }

// }

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