#include <stdio.h>
#include "./threads.h"

ThreadList threads;

DWORD WINAPI add(void* _param) {
    printf("Thread started\n");
    PARAM* param = (PARAM*)_param;
    int* arg = (int*)(param->arg);
    int* result = (int*)(param->result);
    printf("Result hier: %d\n", *result);
    printf("Arg hier: %d\n", *arg);
    *result = *arg + 1;
    return 0;
}

int main() {
    
    threads = mallocThreadList();

    int result = 0;
    int arg = 1;
    createThread(&threads, add, &arg, &result);

    while (result == 0)
    {
        printf("Waiting for thread to finish...\n");
    }
    printf("Result: %d\n", result);

    waitForThreads(&threads);
    return 0;
}