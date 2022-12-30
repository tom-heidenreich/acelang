export default class AddressManager {

    private readonly addressSize: number
    private reservedAddresses: number[] = []

    private addresses: number[] = []
    private nextAddress: number = 0

    public constructor(addressSize?: number) {
        this.addressSize = addressSize || 4
    }

    private count(): number {
        // generate the next address
        const address = this.nextAddress++
        // check if the address is reserved
        if (this.reservedAddresses.includes(address)) {
            // if it is, generate the next address
            return this.count()
        }
        // add the address to the list
        this.addresses.push(address)
        // return the address
        return address
    }

    public get address(): string {
        // get the next address
        const address = this.count()
        // format to hex
        const hex = address.toString(16).padStart(this.addressSize, '0')
        // return the address
        return `0x${hex}`
    }

    public releaseAddress(address: number) {
        // remove the address from the list
        this.addresses = this.addresses.filter(a => a !== address)
    }

    public reserveAddress(address: number) {
        // add the address to the list
        this.reservedAddresses.push(address)
    }
}