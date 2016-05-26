export default {
    'groups': [{
        'label': 'mouth',
        'points': 6
    }, {
        'label': 'nose',
        'points': 3,
        'connectivity': ['0 1', '1 2']
    }, {
        'label': 'left_eye',
        'points': 8,
        'connectivity': ['0:7', '7 0']
    }, {
        'label': 'right_eye',
        'points': 8,
        'connectivity': 'cycle'
    }, {
        'label': 'chin',
        'points': 1
    }]
};
