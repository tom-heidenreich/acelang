#include <stdio.h>
#include "./threads.h"

DWORD WINAPI wait() {
    Sleep(2000);
    printf("waited\n");
    return 0;
}

int main() {

    ThreadList threads = mallocThreadList();
    
    const char a[] = "hello world";
    printf("%s\n", a);

    wait();
    Sleep(1000);
    printf("done\n");

    waitForThreads(threads);
    return 0;
}