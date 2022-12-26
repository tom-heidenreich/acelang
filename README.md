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
} elif (myVar == "world") {
    console.log("world")
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
`note: calling a function without sync keyword in a synchronized block will be executed asynchronously`

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
    public func myFunc() {
        console.log(this.myVar)
    }

    # methods with parameters)
    public func myFunc(myVar: string) {
        console.log(myVar)
    }

    # static methods
    public static func myFunc2() {
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
    public func myFunc() {
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