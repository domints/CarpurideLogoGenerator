export interface Partition {
    name: string,
    size: number,
    offset: number
}

export const PartitionDefSize = 0x20;
export const PartitionNameMaxSize = 0x18;
export const LogoPartitionName = 'logo.bin'
