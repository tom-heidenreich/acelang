# ACElang
`async compiled execution language`

A compiled language, similar to typescript.
This language is designed to replace javascript in the backend.

## Why should you use it?
* executes faster than javascript
* compiles faster than typescript
* can import javascript/typescript modules
* `===` will check if it has the same memory address


## Documentation

### Comments ✔
```ace
# comment
```

### declare variable ✔
```ace
var myVar = "hello world"
```

### without initialization ✔
```ace
var myVar2: string
```

### declare constant ✔
```ace
const myConst = "hello world"
```

### if-else ✔
```ace
if (myVar == "hello world") {
    console.log("hello world")
} else {
    console.log("not hello world")
}
```

### if-else if ✔
```ace
if (myVar == "hello world") {
    console.log("hello world")
} else if (myVar == "hello") {
    console.log("hello")
} else {
    console.log("not hello world")
}
```

### functions ✔
```ace
func myFunc() {
    console.log("hello world")
}
```

### functions with parameters ✔
```ace
func myFunc2(myVar: string) {
    console.log(myVar)
}
```

### functions with return value ✔
```ace
func myFunc3(myVar: string): string {
    return myVar
}
```

### for loop
```ace
for (var i = 0; i < 10; i++) {
    console.log(i)
}
```

### while loop ✔
```ace
var i = 0
while (i < 10) {
    console.log(i)
    i++
}
```

### synchronized block ✔
```ace
sync {
    const value = fetch("https://example.com")
    console.log(value)
}
```

### synchronized function ✔
```ace
sync func myFunc4() {
    const value = fetch("https://example.com")
    console.log(value)
}
```

### class
```ace
class myClass {

    # attributes
    public const myConst = "hello world"    # const can be initialized in constructor, too
    private var myVar: string
    public static var myVar2: string

    # constructor   (supports private and multiple constructors)
    public constructor(myVar: string) {
        this.myVar = myVar
    }

    # methods
    public myFunc() {
        console.log(this.myVar)
    }

    # methods with parameters)
    public myFunc(myVar: string) {
        console.log(myVar)
    }

    # static methods
    public static myFunc2() {
        console.log("hello world")
    }
}
```

### inheritance
```ace
class myClass2 extends myClass {

    # constructor
    public constructor(myVar: string) {
        super(myVar)
    }

    # override methods
    public myFunc() {
        console.log("hello world")
    }
}
```

### types ✔
```ace
# unions
type number = int | float
# struct
type User = {
    name: string,
    age: number,
}
# arrays
type FriendList = User[]
# map
type UserNumberMap = { [key: string]: number }
# arrays with unions
type NumberList = (int | float)[]
```