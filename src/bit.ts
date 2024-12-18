import { iter } from 'joshkaposh-iterator/src/iter/index.js'
import { IterInputType } from 'joshkaposh-iterator/src/types.js'

/**
 * counts the number of set bits in the integer `bits`
 */
export function hamming_weight(bits: number) {
    bits -= (bits >> 1) & 0x55555555
    bits = (bits & 0x33333333) + ((bits >>> 2) & 0x33333333)
    return (((bits + (bits >>> 4)) & 0xf0f0f0f) * 0x1010101) >> 24;
}

const deBruijn = [0, 48, -1, -1, 31, -1, 15, 51, -1, 63, 5, -1, -1, -1, 19, -1, 23, 28, -1, -1, -1, 40, 36, 46, -1, 13, -1, -1, -1, 34, -1, 58, -1, 60, 2, 43, 55, -1, -1, -1, 50, 62, 4, -1, 18, 27, -1, 39, 45, -1, -1, 33, 57, -1, 1, 54, -1, 49, -1, 17, -1, -1, 32, -1, 53, -1, 16, -1, -1, 52, -1, -1, -1, 64, 6, 7, 8, -1, 9, -1, -1, -1, 20, 10, -1, -1, 24, -1, 29, -1, -1, 21, -1, 11, -1, -1, 41, -1, 25, 37, -1, 47, -1, 30, 14, -1, -1, -1, -1, 22, -1, -1, 35, 12, -1, -1, -1, 59, 42, -1, -1, 61, 3, 26, 38, 44, -1, 56];
const multiplicator = BigInt("0x6c04f118e9966f6b");

const
    b1 = BigInt(1),
    b2 = BigInt(2),
    b4 = BigInt(4),
    b8 = BigInt(8),
    b16 = BigInt(16),
    b32 = BigInt(32),
    b57 = BigInt(57);

/**
 * Returns the most significant bit (msb) of an integer
 */
export function msb32(n: number) {
    // @ts-expect-error
    n = BigInt(n)
    // @ts-expect-error
    n |= n >> b1;
    // @ts-expect-error
    n |= n >> b2;
    // @ts-expect-error
    n |= n >> b4;
    // @ts-expect-error
    n |= n >> b8
    // @ts-expect-error
    n |= n >> b16
    // @ts-expect-error
    n |= n >> b32

    return deBruijn[BigInt.asUintN(64, (BigInt.asUintN(
        // @ts-expect-error
        64, (n * multiplicator))) >> b57
    ) as unknown as number]

}


/**
 * Returns the least significant bit (lsb) of an integer
 */
export function lsb32(n: number) {
    // @ts-expect-error
    n = BigInt(n);
    n = -n | n;
    return deBruijn[
        BigInt.asUintN(64, (BigInt.asUintN(64,
            // @ts-expect-error
            (~(n) * multiplicator))) >> b57) as unknown as number
    ]
}


export function carrot_left(n: number, times: number) {
    for (let i = 0; i < times; i++) {
        n = Math.floor(n * 0.5);
    }
    return n;
}

export function shift_left(n: number, times: number) {
    return n * Math.pow(2, times);
}

export function check(bitmask: number, bit: number) {
    if (bitmask === 0 && bit === 0) {
        return true;
    }
    return ((bitmask >> bit) & 1) !== 0;
}

export function set(bitmask: number, bit: number) {
    return bitmask | (1 << bit);
}

export function set_many(bitmask: number, ...indices: (boolean | number)[]) {
    for (const i of indices) {
        // @ts-expect-error
        bitmask = set(bitmask, i);
    }
    return bitmask;
}

export function set_to(bitmask: number, bit: number, enabled: 0 | 1 | false | true) {
    // @ts-expect-error
    return (bitmask & ~(1 << bit)) | (enabled << bit)
}

export function clear(bitmask: number, bit: number) {
    return bitmask & ~(1 << bit);
}

export function toggle(bitmask: number, bit: number) {
    return bitmask ^ (1 << bit);
}

// export function trailing_zeros2(n: number) {
//     let bitpos = 0;
//     let bitset = n;
//     while (bitset !== 0) {
//         bitpos++;
//         bitset = bitset >> 1;
//     }
//     return bitpos;
// }

/**
 * returns the number of trailing zeros in the binary representation of 'n'
 */
export function trailing_zeros(n: number): number {
    if (n === 0) {
        return 32
    } else {
        let i = -1;
        let count = 0;
        while (true) {
            i++;
            if (check(n, i)) {
                break;
            }
            count++;
        }
        return count;
    }
}

export function count_ones(n: number) {
    let count = 0;
    let mask = 1;
    for (let i = 0; i < 32; i++) {
        if ((mask & n) !== 0) {
            count++;
        }
        mask <<= 1;
    }
    return count;
}

export function is_subset(bits: IterInputType<number>, target: number): boolean {
    return iter(bits as IterInputType<number>).all((bit: number) => check(target, bit));
}