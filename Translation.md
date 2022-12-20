# Example 1

```ts
const a = "hello world"

func wait() {
    sleep(2000)
    print('waited')
}

print(a)
wait()
sleep(1000)
print("done")
```

will compile to

```c
#include <stdio.h>
#include "./threads.h"

ThreadList threads;

DWORD WINAPI wait() {
    createThread(&threads, Sleep, (LPVOID) 2000);
    printf("waited\n");
    return 0;
}

int main() {

    threads =  mallocThreadList();
    
    const char a[] = "hello world";
    printf("%s\n", a);

    createThread(&threads, wait, NULL);
    createThread(&threads, Sleep, (LPVOID) 1000);
    printf("done\n");

    waitForThreads(threads);
    return 0;
}
```
Program will execute almost instantly
Output:
```
$ -> hello world
$ -> done
$ -> waited
```

# Example 2

```ts
const a = "hello world"

sync func wait() {
    sleep(2000)
    print('waited')
}

print(a)
wait()
sleep(1000)
print("done")
```

will compile to

```c
#include <stdio.h>
#include "./threads.h"

ThreadList threads;

DWORD WINAPI wait() {
    Sleep(2000);
    printf("waited\n");
    return 0;
}

int main() {

    threads =  mallocThreadList();
    
    const char a[] = "hello world";
    printf("%s\n", a);

    createThread(&threads, wait, NULL);
    createThread(&threads, Sleep, (LPVOID) 1000);
    printf("done\n");

    waitForThreads(threads);
    return 0;
}
```
Program will take about 2 seconds to execute
Output:
```
$ -> hello world
$ -> done
$ -> waited
```

# Example 3

```ts
const a = "hello world"

func wait() {
    sleep(2000)
    print('waited')
}

sync {
    print(a)
    wait()
    sleep(1000)
    print("done")
}
```

will compile to

```c
#include <stdio.h>
#include "./threads.h"

ThreadList threads;

DWORD WINAPI wait() {
    createThread(&threads, Sleep, (LPVOID) 2000);
    printf("waited\n");
    return 0;
}

int main() {

    threads =  mallocThreadList();
    
    const char a[] = "hello world";
    printf("%s\n", a);

    wait();
    Sleep(1000);
    printf("done\n");

    waitForThreads(threads);
    return 0;
}
```
Program will take about 1 seconds to execute
Output:
```
$ -> hello world
$ -> waited
$ -> done
```

# Example 4

```ts
const a = "hello world"

sync func wait() {
    sleep(2000)
    print('waited')
}

sync {
    print(a)
    wait()
    sleep(1000)
    print("done")
}
```

will compile to

```c
#include <stdio.h>
#include "./threads.h"

ThreadList threads;

DWORD WINAPI wait() {
    Sleep(2000);
    printf("waited\n");
    return 0;
}

int main() {

    threads =  mallocThreadList();
    
    const char a[] = "hello world";
    printf("%s\n", a);

    wait();
    Sleep(1000);
    printf("done\n");

    waitForThreads(threads);
    return 0;
}
```
Program will take about 3 seconds to execute
Output:
```
$ -> hello world
$ -> waited
$ -> done
```