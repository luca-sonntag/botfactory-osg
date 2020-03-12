// var REQUEST_PATH = "http://localhost:8080/api/system/osb/template"; 
var REQUEST_PATH = "online_editor_example_response.json";
var SUBMIT_PATH = "http://localhost:8080/api/system/osb";

var betsystem;
var system_strategy_template;
var custom_strategy_template;
var error_template;


var token = getUrlParam("t", null);
//var token = getCookie("token");

$(document).ready(async function() {

    if (token == null) {
        showErrorPopup("Ihre Sitzung ist abgelaufen. Bitte fordern Sie einen neuen Link an über das Telegram Menü!", "Sitzung abgelaufen", "", true);
        return;
    }

    await $.ajax({
        url: REQUEST_PATH,
        type: 'get',
        headers: { token: token },
    }).done(function(data, status, req) {
        betsystem = data;
    }).fail(function(xhr, status, error) {
        showErrorPopup("Ein Fehler ist beim Aufrufen der Daten aufgetreten!", xhr.status, error, true);
    });

    await $.get('templates/system-strategy.html', function(data) { system_strategy_template = data; });
    await $.get('templates/custom-strategy.html', function(data) { custom_strategy_template = data; });

    error_template = "<div class='error-msg' error='{{type}}'>{{msg}}</div>";

    betsystem.listStrategies.forEach(it => it.uniqueId = ID());
    console.log(betsystem);

    $('#title').val(betsystem.title);
    $('#submitBtn').on('click', submit);

    Array.from($('#checkboxes .material-checkbox')).forEach(cb => {
        cb.onclick = function(event) {
            if (!cb.classList.contains("checkbox-checked")) {
                let oldCB = $($('#checkboxes .checkbox-checked')[0]);
                let newCB = $(cb);

                oldCB.toggleClass('checkbox-checked checkbox-unchecked');
                newCB.toggleClass('checkbox-checked checkbox-unchecked');

                let factor = parseFloat($(newCB.children()[0]).attr("value")) / parseFloat($(oldCB.children()[0]).attr("value"));

                betsystem.maxStakeSum *= factor;
                betsystem.listStrategies.forEach(st => st.stake *= factor);

                buildUI();
            }
        }
    });

    buildUI();

    //Setup Popup
    var modal = document.getElementById("myModal");
    var span = document.getElementsByClassName("close")[0];
    span.onclick = function() {
            modal.style.display = "none";
        }
        // When the user clicks anywhere outside of the popup, close it
    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
});

function showErrorPopup(errorText, status, code, isClose) {
    $('#modal-unsuccess-text').html(errorText);
    $('#modal-success-content').css('display', 'none');
    $('#modal-unsuccess-content').css('display', 'inherit');
    $('#modal-errorcode').html(status + " " + code);
    $("#myModal").css("display", "block");
    if (isClose) $($('.close')[0]).css("display", "none"); //Close-Button ausblenden
}

function showSuccessPopup() {
    $('#modal-success-content').css('display', 'inherit');
    $('#modal-unsuccess-content').css('display', 'none');
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for (var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}


function buildUI() {
    $('#sportType').html(betsystem.sportsType.toUpperCase());
    $('#sollGesamteinsatz').html(betsystem.maxStakeSum * 100 + "%");

    $('#strategy-box').html("");
    new Set(betsystem.listStrategies.map(s => s.gameUnit)).forEach(gameUnit => {
        let strategy_system_html = '<div class="strategy-system">';

        Array.from(betsystem.listStrategies.filter(it => it.gameUnit == gameUnit)).sort(function(a, b) {
            return a.scope.localeCompare(b.scope) * -1;
        }).forEach(strategy => {
            let template;
            if (strategy.scope == "system") {
                template = system_strategy_template;
            } else {
                template = custom_strategy_template;
            }
            var row = Mustache.render(template, {
                gameUnit: strategy.gameUnit,
                scope: strategy.scope,
                //                title: strategy.description.title,
                title: 'Placeholder for Strategytitle',
                odds: strategy.oddsCondition.compareValue,
                stake: (strategy.stake * 100).toFixed(2),
                sum: (strategy.stake * 100).toFixed(2),
                id: strategy.uniqueId
            });
            strategy_system_html = strategy_system_html.concat(row);
        });
        strategy_system_html = strategy_system_html.concat('<div class="table-line"></div></div>');

        $('#strategy-box').append(strategy_system_html);

        applyInputEvents();
    });
    renderStakeSums();
}

function applyInputEvents() {
    //Detect input changes
    Array.from($('.strategy-system input')).forEach(input => {
        let callback = function(event) {
            let strategyHtml = event.target.parentElement.parentElement;
            let index = betsystem.listStrategies.findIndex(it => it.uniqueId == parseInt(strategyHtml.getAttribute('id')));
            if (input.parentElement.classList.contains("col2")) {
                if (parseFloat(input.value) < 1) {
                    input.value = 1;
                } else {
                    betsystem.listStrategies[index].oddsCondition.compareValue = input.value;
                }
            } else {
                if (parseFloat(input.value) < 0) {
                    input.value = 0;

                } else {
                    betsystem.listStrategies[index].stake = input.value / 100;
                    gameunit = strategyHtml.getAttribute('gameunit');
                    renderStakeSums();
                }
            }
        };
        $(input).on('input', callback);
    });
    $('#title').on('input', validate);
}

function validate() {
    let activeErrors = Array.from($('#error-box .error-msg'));

    //Error StakeSumError
    let soll = (parseFloat($('#sollGesamteinsatz').html()) / 100).toFixed(4);
    let ist = (parseFloat($('#istGesamteinsatz').html()) / 100).toFixed(4);
    let stakesumerror_html = activeErrors.filter(it => it.getAttribute('error') == "StakeSumError");
    if (soll != ist) {
        let error_msg_html = Mustache.render(error_template, {
            msg: "GESAMTEINSATZ MUSS " + $('#sollGesamteinsatz').html() + " ergeben!",
            type: "StakeSumError"
        });
        if (stakesumerror_html.length == 0) {
            $('#error-box').append(error_msg_html);
        } else {
            $(stakesumerror_html).html(error_msg_html);
        }
    } else {
        if (stakesumerror_html.length > 0) $(stakesumerror_html).remove();
    }

    //Error TitleEmptyError
    let titleemptyerror_html = activeErrors.filter(it => it.getAttribute('error') == "TitleEmptyError");
    if ($('#title').val() == "") {
        let error_msg_html = Mustache.render(error_template, {
            msg: "TITEL darf nicht leer sein!",
            type: "TitleEmptyError"
        });
        if (titleemptyerror_html.length == 0) {
            $('#error-box').append(error_msg_html);
        } else {
            $(titleemptyerror_html).html(error_msg_html);
        }
    } else {
        if (titleemptyerror_html.length > 0) $(titleemptyerror_html).remove();
    }

    activeErrors = Array.from($('#error-box .error-msg'));

    //Submit-Button Enabled/Disabled
    if (activeErrors.length > 0) {
        $('#submitBtn')[0].setAttribute('disabled', "");
    } else {
        $('#submitBtn')[0].removeAttribute('disabled');
        betsystem.title = $('#title').val();
    }
}

function renderStakeSums() {
    new Set(betsystem.listStrategies.map(s => s.gameUnit)).forEach(gameunit => {
        col = Array.from($('.strategy-item .col4')).find(it => parseInt(it.parentElement.getAttribute('gameunit')) == gameunit);
        unitStakeSum = betsystem.listStrategies.filter(it => it.gameUnit == parseInt(gameunit)).map(it => it.stake).reduce((a, b) => a + b, 0) * 100;
        $(col).html(unitStakeSum.toFixed(2));
    });
    allStakeSum = betsystem.listStrategies.map(it => it.stake).reduce((a, b) => a + b, 0) * 100
    $('#istGesamteinsatz').html(allStakeSum.toFixed(2) + "%");
    validate();
}

function splitStrategy(event) {
    let parent = event.target.parentElement.parentElement;
    let gameUnit = parseInt(parent.getAttribute("gameUnit"));
    var systemStrategy = betsystem.listStrategies.find(s => s.gameUnit == 1 && s.scope == "system");
    customStrategy = {
        "gameUnit": gameUnit,
        "descriptionId": systemStrategy.descriptionId,
        //        "title": systemStrategy.description.title,
        "title": 'Placeholder',
        "scope": "custom",
        "line": systemStrategy.line,
        "stake": 0,
        "oddsCondition": {
            "compareValue": 1,
            "deviation": systemStrategy.oddsCondition.deviation
        },
        "systemId": systemStrategy.systemId,
        "alternativeStrategyId": systemStrategy.alternativeStrategyId,
        "index": systemStrategy.index + 1,
        "uniqueId": ID()
    }

    betsystem.listStrategies.push(customStrategy);

    var row = Mustache.render(custom_strategy_template, {
        gameUnit: customStrategy.gameUnit,
        scope: customStrategy.scope,
        title: customStrategy.title,
        odds: customStrategy.odds,
        stake: (customStrategy.stake * 100).toFixed(2),
        sum: (customStrategy.stake * 100).toFixed(2),
        id: customStrategy.uniqueId
    });

    var children = $(parent.parentElement).children();
    $(children[children.length - 2]).after(row);
    applyInputEvents();
}

function removeStrategy(event) {
    let parent = event.target.parentElement.parentElement;
    let gameUnit = parent.getAttribute("gameUnit");
    betsystem.listStrategies.splice(betsystem.listStrategies.findIndex(it => it.gameUnit == gameUnit && it.scope == "custom"), 1);
    $(parent).remove();
    renderStakeSums();
    applyInputEvents();
}

var ID = function() {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return Math.random().toString().substr(2, 9);
};


function getUrlParam(parameter, defaultvalue) {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value) {
        vars[key] = value;
    });
    var urlparameter = defaultvalue;
    if (window.location.href.indexOf(parameter) > -1) {
        urlparameter = vars[parameter];
    }
    return urlparameter;
}

function submit(event = null) {

    if (token == null) return;

    //Copy betsystem
    let temp_betsystem = JSON.parse(JSON.stringify(betsystem));

    //Remove temporary id in temp_betsystem.strategies
    temp_betsystem.listStrategies.forEach(it => {
        delete it["uniqueId"];
    });

    $.ajax({
            url: SUBMIT_PATH,
            type: 'post',
            headers: { token: token },
            contentType: "application/json; charset=utf-8",
            data: JSON.stringify(temp_betsystem)
        }).done(function(data) {
            showSuccessPopup();
        })
        .fail(function(xhr, status, error) {
            showErrorPopup("Ein Fehler ist beim Speichern aufgetreten!", status, error, false);
        })
        .always(function() {
            document.getElementById("myModal").style.display = "block";
        });
}