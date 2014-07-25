landmarker
==========

3D mesh annotation - in the browser.


### Landmark JSON format

Landmarks are served as JSON payloads with the following structure:


```text
{
    "groups": [
        {
            "connectivity": [
                [
                    0,
                    1
                ],
                [
                    1,
                    2
                ],
                [
                    2,
                    3
                ]
            ],
            "label": "chin",
            "landmarks": [
                {
                    "point": [
                        987.9485071892709,
                        1294.1142092274872
                    ]
                },
                {
                    "point": [
                        96.78188790959075,
                        1246.8784017112353
                    ]
                },
                {
                    "point": [
                        null,
                        null
                    ]
                },
                {
                    "point": [
                        303.2297533797871,
                        167.20280133976166
                    ]
                }
            ]
        },
        {
            "connectivity": [
                [
                    0,
                    1
                ]
            ],
            "label": "leye",
            "landmarks": [
                {
                    "point": [
                        null,
                        null
                    ]
                }
            ]
        }
    ],
    "version": 1
}
```
