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

DWORD WINAPI sleep(void* param) {
    DWORD* time = (DWORD*)param;
    Sleep(time);
    return 0;
}

DWORD WINAPI wait(void* param) {
    ThreadList* threads = (ThreadList*)param;
    createThread(threads, sleep, (int*) 2000);
    printf("waited\n");
    return 0;
}

int main() {

    ThreadList threads = mallocThreadList();
    
    const char a[] = "hello world";
    printf("%s\n", a);

    createThread(&threads, wait, &threads);
    createThread(&threads, sleep, (DWORD*) 1000);
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

DWORD WINAPI sleep(void* param) {
    DWORD* time = (DWORD*)param;
    Sleep(time);
    return 0;
}

DWORD WINAPI wait() {
    Sleep(2000);
    printf("waited\n");
    return 0;
}

int main() {

    ThreadList threads = mallocThreadList();
    
    const char a[] = "hello world";
    printf("%s\n", a);

    createThread(&threads, wait, NULL);
    createThread(&threads, sleep, (DWORD*) 1000);
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

# Example 4

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

DWORD WINAPI wait() {
    Sleep(2000);
    printf("waited\n");
    return 0;
}

int main() {
    
    const char a[] = "hello world";
    printf("%s\n", a);

    wait();
    Sleep(1000);
    printf("done\n");

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