export default class AddressManager {
    private addresses: number[] = []
    private nextAddress = 0

    private count(): number {
        const address = this.nextAddress
        this.nextAddress++
        return address
    }

    public get address(): string {
        // get the next address
        const address = this.count()
        // format to hex with 4 digits
        const hex = address.toString(16).padStart(4, '0')
        // return the address
        return `0x${hex}`
    }

    public releaseAddress(address: number) {
        this.addresses.push(address)
    }
}