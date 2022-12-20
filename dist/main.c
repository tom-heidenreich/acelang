#include <stdio.h>
#include "./threads.h"

ThreadList threads;

DWORD WINAPI add(void* _arg) {
    printf("Thread started\n");
    PARAM* arg = (PARAM*)_arg;
    int* param = (int*)arg->param;
    int* result = (int*)arg->result;
    printf("Result hier: %d\n", *result);
    printf("Param hier: %d\n", *param);
    *result = *param + 1;
    return 0;
}

int main() {
    
    threads = mallocThreadList();

    int result = 0;
    createThread(&threads, add, &result, &result);

    while (result == 0)
    {
        printf("Waiting for thread to finish...\n");
    }
    printf("Result: %d\n", result);

    waitForThreads(&threads);
    return 0;
}