#!/bin/bash

collections=(users channels clients contactGroups mediators)

for c in ${collections[@]}
do
  mongodump --db openhim --collection $c
done