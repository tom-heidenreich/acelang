type ReservedAddress = {
    address: number,
    name?: string,
}

export default class AddressManager {

    private readonly addressSize: number
    private reservedAddresses: ReservedAddress[] = []

    private addresses: number[] = []
    private nextAddress: number = 0

    public constructor(addressSize?: number) {
        this.addressSize = addressSize || 4
    }

    private count(): number {
        // generate the next address
        const address = this.nextAddress++
        // check if the address is reserved
        const reserved = this.reservedAddresses.find(a => a.address === address)
        // if the address is reserved, try again
        if (reserved) {
            return this.count()
        }
        // add the address to the list
        this.addresses.push(address)
        // return the address
        return address
    }

    private format(address: number): string {
        // format to hex
        const hex = address.toString(16).padStart(this.addressSize, '0')
        // return the address
        return `0x${hex}`
    }

    public get address(): string {
        // get the next address
        const address = this.count()
        return this.format(address)
    }

    public free(address: string) {
        // hex string to number
        const num = parseInt(address, 16)
        // remove the address from the list
        this.addresses = this.addresses.filter(a => a !== num)
    }

    public reserveAddress(address: number, name?: string) {
        // add the address to the list
        this.reservedAddresses.push({
            address,
            name,
        })
    }

    public getReserved(name: string): string {
        // return the reserved addresses
        const reserved = this.reservedAddresses.filter(a => a.name === name)
        if(reserved.length === 0) {
            throw new Error(`No reserved address found for ${name}`)
        }
        return this.format(reserved[0].address)
    }
}