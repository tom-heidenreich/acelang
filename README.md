# ACElang
`async compiled execution language`

A compiled language, similar to typescript.
This language is designed to replace javascript in the backend.

## Why should you use it?
* executes faster than javascript
* compiles faster than typescript
* can import javascript/typescript modules
* `===` will check if it has the same memory address


## Design

### Comments
```
# comment
```

### declare variable
```
var myVar = "hello world"
```

### without initialization
```
var myVar2: string
```

### declare constant
```
const myConst = "hello world"
```

### if-else
```
if (myVar == "hello world") {
    console.log("hello world")
} else {
    console.log("not hello world")
}
```

### if-else if
```
if (myVar == "hello world") {
    console.log("hello world")
} else if (myVar == "hello") {
    console.log("hello")
} else {
    console.log("not hello world")
}
```

### functions
```
func myFunc() {
    console.log("hello world")
}
```

### functions with parameters
```
func myFunc2(myVar: string) {
    console.log(myVar)
}
```

### functions with return value
```
func myFunc3(myVar: string): string {
    return myVar
}
```

### for loop
```
for (var i = 0; i < 10; i++) {
    console.log(i)
}
```

### while loop
```
var i = 0
while (i < 10) {
    console.log(i)
    i++
}
```

### synchronized block
```
sync {
    const value = fetch("https://example.com")
    console.log(value)
}
```

### synchronized function
```
sync func myFunc4() {
    const value = fetch("https://example.com")
    console.log(value)
}
```

### class
```
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
```
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

### types
```
type number = int | float

"number": {
    "oneOf": [
        {
            "type": "integer"
        },
        {
            "type": "number"
        }
    ]
}

type User = {
    name: string,
    age: number,
}

"User": {
    "type": "object",
    "properties": {
        "name": {
            "type": "string"
        },
        "age": {
            "type": "number"
        }
    }
}

type FriendList = User[]
"FriendList": {
    "type": "array",
    "items": "User"
}

type NumberList = (int | float)[]

"NumberList": {
    "type": "array",
    "items": {
        "oneOf": [
            {
                "type": "integer"
            },
            {
                "type": "number"
            }
        ]
    }
}
```

## New Instruction Design

```
# will create field 'a', malloc 0x0000 and move 'hello' to 0x0000
const a = "hello"

# will create field 'b' with a pointer to 0x0000
const b = a

# will create field 'c', malloc 0x0001, move '1' to 0x0001, add '2' to 0x0001
const c = 1 + 2

# will create field 'd', (somehow recognize it's not a pointer, ) malloc 0x0002, move 0x0001 to 0x0002, add '1' to 0x0002
const d = c + 1

# will create field 'e'
func e() {

    # will create field 'a' in 'e', malloc 0x0003, move '1' to 0x0003, add '1' to 0x0003
    const a = 1 + 1

    # will move 0x0003 to 0xffff (return cache) 
    return a
}

# will create field 'f', malloc 0x0005, run 'e' and move 0xffff to 0x0005 
const f = a()
```

# Runtime

## Memory

* First bit shows if value is ready or not