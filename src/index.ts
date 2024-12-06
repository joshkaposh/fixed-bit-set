import { iter, range, done, Iterator, Range, type IterInputType, item, DoubleEndedIterator } from 'joshkaposh-iterator'
import { assert, resize } from 'joshkaposh-iterator/src/util.js';
import { is_some, Option } from 'joshkaposh-option'
import { carrot_left, clear, set, set_to, trailing_zeros } from "./bit.js";
import { u32 } from "./Intrinsics/index.js";

const BITS = 32;

function div_rem(x: number, d: number): [number, number] {
    return [Math.floor(x / d), Math.floor(x % d)];
}

export class FixedBitSet {
    #data: number[];
    #length: number;

    constructor(data: number[] = [], length: number = 0) {
        this.#data = data;
        this.#length = length;
    }

    static default() {
        return FixedBitSet.with_capacity(0);
    }

    static with_capacity(bits: number) {
        let [blocks, rem] = div_rem(bits, BITS);
        blocks += Number(rem > 0) * 1
        return new FixedBitSet(Array.from({ length: blocks }, () => 0), bits)
    }

    static with_capacity_and_blocks(bits: number, blocks: Iterable<number>) {
        let [n_blocks, rem] = div_rem(bits, BITS)
        n_blocks += Number(rem > 0) * 1
        const data = Array.from(blocks);
        if (data.length !== n_blocks) {
            resize(data, n_blocks, 0);
        }
        const end = data.length * 32;
        for (const [block, mask] of new Masks(range(bits, end), end)) {
            data[block] &= Number(!mask);
        }
        return new FixedBitSet(data, bits)
    }

    static from(src: IterInputType<number>) {
        const fb = FixedBitSet.with_capacity(0);
        fb.extend(src);
        return fb;
    }

    static and(a: FixedBitSet, b: FixedBitSet): FixedBitSet {
        const [short, long] = a.len() <= b.len() ?
            [a.#data, b.#data] :
            [b.#data, a.#data]
        const data = Array.from(short, (k, i) => k & long[i])
        const len = Math.min(a.len(), b.len())
        return new FixedBitSet(data, len);
    }

    static or(a: FixedBitSet, b: FixedBitSet): FixedBitSet {
        const [short, long] = a.len() <= b.len() ?
            [a.#data, b.#data] :
            [b.#data, a.#data]
        const data = Array.from(short, (k, i) => k | long[i])
        const len = Math.max(a.len(), b.len())
        return new FixedBitSet(data, len);
    }

    static xor(a: FixedBitSet, b: FixedBitSet): FixedBitSet {
        const [short, long] = a.len() <= b.len() ?
            [a.#data, b.#data] :
            [b.#data, a.#data]
        const data = Array.from(short, (k, i) => k ^ long[i])
        const len = Math.max(a.len(), b.len())
        return new FixedBitSet(data, len);
    }

    and(other: FixedBitSet) {
        const l = other.len()
        for (let i = 0; i < l; i++) {
            if (!is_some(this.#data[i])) {
                break;
            }
            this.#data[i] &= other.#data[i]
        }
    }

    or(other: FixedBitSet) {
        const len = other.len()
        if (this.#data.length < len) {
            this.grow(len);
        }
        for (let i = 0; i < len; i++) {
            this.#data[i] |= other.#data[i]
        }
    }

    xor(other: FixedBitSet) {
        const len = other.len()
        if (this.#data.length < len) {
            this.grow(len);
        }
        for (let i = 0; i < len; i++) {
            this.#data[i] ^= other.#data[i]
        }
    }

    eq(other: FixedBitSet) {
        for (let i = 0; i < this.#data.length; i++) {
            if (!is_some(other.#data[i])) {
                break;
            }
            if (this.#data[i] != other.#data[i]) {
                return false
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

    clone(): FixedBitSet {
        return new FixedBitSet([...this.#data], this.len())
    }

    grow(bits: number) {
        let [blocks, rem] = div_rem(bits, BITS);
        blocks += Number(rem > 0) * 1;
        if (bits > this.#length) {
            this.#length = bits;
            resize(this.#data, blocks, 0);
        }
    }

    grow_insert(bits: number) {
        this.grow(bits + 1)
        const [blocks] = div_rem(bits, BITS);
        this.#data[blocks] = set(this.#data[blocks], bits);
    }

    len() {
        return this.#length;
    }

    is_empty() {
        return this.#length === 0;
    }
    is_clear(): boolean {
        return iter(this.#data).all((v) => v === 0)
    }

    get(bit: number): boolean {
        return this.contains(bit)
    }

    contains(bit: number): boolean {
        const [block, i] = div_rem(bit, BITS)
        const b = this.#data[block]
        if (!is_some(b)) {
            return false
        }
        return (b & (1 << i)) !== 0
    }

    clear() {
        for (let i = 0; i < this.#data.length; i++) {
            this.#data[i] = 0;
        }
    }

    /**
     * @summary Enable `bit`
     */
    insert(bit: number) {
        assert(bit < this.#length);
        const [block, i] = div_rem(bit, BITS);
        this.#data[block] = set(this.#data[block], i);
    }

    /**
     * @summary Enable 'bit' and return its previous value
     */
    put(bit: number): 0 | 1 {
        assert(bit < this.#length)
        const [block, i] = div_rem(bit, BITS)
        let word = this.#data[block];
        const prev = (word & (1 << i)) !== 0
        word |= 1 << i;
        this.#data[block] = word;
        return Number(prev) * 1 as 0 | 1
    }

    /**
     * @summary Toggle `bit`.
     * @description 
     * Toggles `bit`
     * 
     *  If `bit` is set to 0,
     *  it is set to 1.
     *  If `bit` is set to 0,
     *  it is set to 1 
     */
    toggle(bit: number) {
        assert(bit < this.#length)
        const [block, i] = div_rem(bit, BITS)
        this.#data[block] ^= 1 << i;
    }

    /**
     * @description Sets a target bit to a target value.
     * @example
     * const f = FixedBitSet.with_capacity(0);
     * 
     * f.set(0, true)
     * f.contains(0) // true
     *
     *  f.set(1, true)
     * f.set(1, false)
     * f.contains(1) // false
    * 
    */
    set(bit: number, enabled: 0 | 1 | false | true) {
        assert(bit < this.#length)
        const [block, i] = div_rem(bit, BITS);
        let elt = this.#data[block];
        elt = enabled ? set(elt, i) : clear(elt, i)
        this.#data[block] = elt;
    }

    copy_bit(from: number, to: number) {
        assert(to < this.#length);
        const [to_block, t] = div_rem(to, BITS);
        const enabled = this.contains(from);
        const to_elt = this.#data[to_block];
        this.#data[to_block] = set_to(to_elt, t, enabled);
    }

    count_ones(range: Range): number {
        assert(range.start <= range.end && range.end <= this.#length);
        let count = 0;

        for (let i = range.start; i < range.end; i++) {
            if (this.contains(i)) {
                count++;
            }
        }
        return count;
    }

    set_range(range: Range, enabled: 0 | 1 | false | true) {
        for (let i = range.start; i < range.end; i++) {
            this.set(i, enabled)
        }
    }

    /**
     * `Range` start is inclusive and end is exclusive.
     * `insert_range()` sets all the bits in the range to 1 
    */
    insert_range(start?: number, end?: number): void;
    insert_range(range: Range): void;
    insert_range(minOrRange: number | Range = 0, max?: number) {
        const r = typeof minOrRange === 'number' ? range(minOrRange, max ?? this.#length) : minOrRange;
        this.set_range(r, 1);
    }

    /**
     * `Range` start is inclusive and end is exclusive.
     * `insert_range()` toggles all the bits in the range.
     * @example
    * const fbs = FixedBitSet.with_capacity(10);
    * fbs.toggle_range();
    * console.log(fbs.ones().collect())// [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    * fbs.toggle_range(4, 8);
    * console.log(fbs.ones().collect())// [0, 1, 2, 3, 8, 9]
    */
    toggle_range(min?: number, max?: number): void;
    toggle_range(range: Range): void;
    toggle_range(minOrRange: number | Range = 0, max?: number) {
        const { start, end } = typeof minOrRange === 'number' ? range(minOrRange, max ?? this.#length) : minOrRange;
        for (let i = start; i < end; i++) {
            this.toggle(i)
        }
    }

    as_slice(): number[] {
        return this.#data;
    }

    ones(): DoubleEndedIterator<number> {
        const opt = split_first(this.as_slice());
        if (opt) {
            const [firstblock, _rem] = opt
            const [lastblock, rem] = split_last(_rem) ?? [0, _rem]
            return new Ones(
                firstblock,
                lastblock,
                0,
                (1 + rem.length) * BITS,
                rem
            )
        } else {
            return new Ones(
                0,
                0,
                0,
                0,
                []
            );
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
        const l = this.#data.length;
        for (let i = 0; i < l; i++) {
            this.#data[i] &= other.#data[i];
        }
        let mn = Math.min(this.#data.length, other.#data.length);
        for (let i = mn; i < this.#data.length; i++) {
            this.#data[i] = 0;
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
            this.#data[i] |= y
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
        const l = this.#data.length;
        for (let i = 0; i < l; i++) {
            this.#data[i] &= !other.#data[i] as unknown as number;
        }
    }

    static symmetric_difference(a: FixedBitSet, b: FixedBitSet) {
        return a.difference(b).chain(b.difference(a))
    }

    symmetric_difference(other: FixedBitSet) {
        return FixedBitSet.symmetric_difference(this, other);
    }

    // in-place symmetric difference of two 'FixedBitSet's;
    // 'self's capacity may be increased to match 'other's
    symmetric_difference_with(other: FixedBitSet) {
        if (other.len() >= this.len()) {
            this.grow(other.len())
        }
        const m = Math.max(this.#data.length, other.#data.length)
        for (let i = 0; i < m; i++) {
            this.#data[i] ^= other.#data[i];
        }
    }

    // returns 'true' if 'self' has no elements in common with 'other' 
    is_disjoint(other: FixedBitSet): boolean {
        return iter(this.#data)
            .zip(iter(other.as_slice()))
            .all(([x, y]) => (x & y) === 0)
    }

    is_subset(other: FixedBitSet): boolean {
        return iter(this.#data)
            .zip(iter(other.as_slice()))
            .all(([x, y]) => (x & Number(!y)) === 0)
            && iter(this.#data).skip(other.as_slice().length).all(x => x === 0)
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
        const n = this.#iter.next();
        return (!n.done && !this.#other.contains(n.value)) ?
            item(n.value) : done();

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
}

class Ones extends DoubleEndedIterator<number> {
    #bitset_front: number;
    #bitset_back: number;
    #block_idx_front: number;
    #block_idx_back: number;
    #remaining_blocks: DoubleEndedIterator<number>

    #copy: [number, number, number, number, ArrayLike<number> | DoubleEndedIterator<number>];

    constructor(bitset_front: number, bitset_back: number, front_block_index: number, back_block_index: number, remaining_blocks: ArrayLike<number> | DoubleEndedIterator<number>) {
        super()
        this.#bitset_front = bitset_front;
        this.#bitset_back = bitset_back;
        this.#block_idx_front = front_block_index
        this.#block_idx_back = back_block_index;
        this.#remaining_blocks = iter(remaining_blocks);
        this.#copy = [bitset_front, bitset_back, front_block_index, back_block_index, iter(remaining_blocks).clone()];
    }

    clone(): Ones {
        return new Ones(this.#bitset_front, this.#bitset_back, this.#block_idx_front, this.#block_idx_back, this.#remaining_blocks.clone())
    }

    into_iter(): DoubleEndedIterator<number> {
        this.#bitset_front = this.#copy[0];
        this.#bitset_back = this.#copy[1];
        this.#block_idx_front = this.#copy[2];
        this.#block_idx_back = this.#copy[3];
        this.#remaining_blocks = iter(this.#copy[4]);
        return this;
    }

    override next(): IteratorResult<number> {
        while (this.#bitset_front === 0) {
            const block = this.#remaining_blocks.next();
            if (block.done) {
                // check back
                if (this.#bitset_back !== 0) {
                    this.#block_idx_front = this.#block_idx_back;
                    this.#bitset_front = 0;
                    const [bitset_back, position] = this.#last_positive_bit_and_unset(this.#bitset_back)
                    this.#bitset_back = bitset_back

                    return item(this.#block_idx_back * position)
                } else {
                    return done();
                }
            } else {
                this.#bitset_front = block.value;
                this.#block_idx_front += BITS;
            }
        }
        const [bitset_front, position] = this.#last_positive_bit_and_unset(this.#bitset_front)
        this.#bitset_front = bitset_front;
        return item(position)
    }

    override next_back(): IteratorResult<number> {
        while (this.#bitset_back === 0) {
            const block = this.#remaining_blocks.next_back();
            if (block.done) {
                if (this.#bitset_front !== 0) {
                    this.#bitset_back = 0;
                    this.#block_idx_back = this.#block_idx_front;
                    const [bitset_front, position] = this.#first_positive_bit_and_unset(this.#bitset_front)
                    this.#bitset_front &= bitset_front

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

    #last_positive_bit_and_unset(n: number): [new_number: number, bit_idx: number] {
        const last_bit = n & -n;
        const position = trailing_zeros(last_bit);

        return [n & n - 1, position];
    }

    #first_positive_bit_and_unset(n: number): [new_number: number, bit_idx: number] {
        const bit_idx = Math.clz32(n);
        const mask = (1 << (BITS - bit_idx - 1)) - 1
        return [n & mask, bit_idx];
    }
}

class Masks extends Iterator<[number, number]> {
    #first_block: number;
    #first_mask: number;
    #last_block: number;
    #last_mask: number;
    #masks: readonly [number, number, number, number];

    constructor(range: Range, len: number) {
        super();
        const start = range.start ?? 0;
        const end = range.end ?? len;

        assert(start <= end && end <= len);

        const masks = new_mask(start, end);
        this.#masks = masks;
        const [first_block, first_mask, last_block, last_mask] = masks

        this.#first_block = first_block;
        this.#first_mask = first_mask;
        this.#last_block = last_block;
        this.#last_mask = last_mask;
    }

    into_iter(): Iterator<[number, number]> {
        this.#first_block = this.#masks[0];
        this.#first_mask = this.#masks[1];
        this.#last_block = this.#masks[2];
        this.#last_mask = this.#masks[3];
        return this;
    }

    next(): IteratorResult<[number, number]> {
        if (this.#first_block < this.#last_block) {
            const res = [this.#first_block, this.#first_mask] as [number, number];
            this.#first_block += 1;
            this.#first_mask = Number(!0);
            return item(res)

        } else if (this.#first_block === this.#last_block) {
            const mask = this.#first_mask & this.#last_mask;
            const res = mask === 0 ? done() : item([this.#first_block, mask])
            this.#first_block += 1;
            return res as IteratorResult<[number, number]>
        } else {
            return done();
        }
    }
}

function new_mask(start: number, end: number) {
    const [first_block, first_rem] = div_rem(start, BITS);
    const [last_block, last_rem] = div_rem(end, BITS);

    const lr = carrot_left(
        carrot_left(u32.MAX, 1),
        BITS - last_rem - 1
    );

    return [
        first_block,
        carrot_left(u32.MAX, first_rem),
        last_block,
        lr
    ] as const

}

function split_first<T>(array: T[]): Option<[T, T[]]> {
    if (array.length > 0) {
        return [array[0], array.slice(1, array.length)]
    }
    return;
}

function split_last<T>(array: T[]): Option<[T, T[]]> {
    if (array.length > 0) {
        return [array[array.length - 1], array.slice(0, array.length - 1)]
    }
    return;
}
