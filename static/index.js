
$(function() {
    var clockpickers = [];
    var socket = io.connect();

    function add_clockpicker(i) {
        $('.clockpicker').eq(i).find('.input-group-addon').removeClass('disabled')
        clockpickers[i] = $('.clockpicker').eq(i).clockpicker({
            afterDone: round_to_5.bind(null, i)
        });
    }

    function remove_clockpickers() {
        $('.clockpicker').find('.input-group-addon').addClass('disabled')
        clockpickers.forEach(function(picker) {
            picker.clockpicker('remove');
        });
    }

    function round_to_5(i) {
        var timetext = $('.clockpicker').eq(i).find('input').val();
        var min = Math.round(parseInt(timetext.split(":")[1]) / 5) * 5;
        $('.clockpicker').eq(i).find('input').val(timetext.split(":")[0] + ":" + ("00" + (min % 60)).slice(-2));
    }

    function render_options(options) {
        var sum = 0;
        for (var i = 0; i < options.length; i++) {
            sum += options[i]['votes'];
        }
        $('.normal-option').remove();
        for (var i = 0; i < options.length; i++) {
            var div = $("#option-example").clone();
            div.addClass("normal-option");
            div.find('label').html(options[i]['name']);
            var bar = div.find('.progress-bar')
            var percentage = sum == 0 ? 0 : Math.round(100 * options[i]['votes'] / sum);
            bar.html(percentage + '%').width(percentage + '%');
            bar.attr('aria-valuenow', percentage);
            div.insertBefore("#other-option");
            div.find('input').on('click', vote.bind(null, i));
            div.show();
        };
    }

    function update(state) {
        console.log(state)
        $('#step1').addClass('inactive')
        $('#step2').addClass('inactive');
        $('#step3').addClass('inactive');

        $("#step1 input").prop('disabled', true);
        $("#step2 input").prop('disabled', true);
        $("#step3 input").prop('disabled', true);
        $("#step4 input").prop('disabled', true);

        $("#step1 .during").hide();
        $("#step4 .before").hide();
        $("#step4 .during").hide();
        $("#step1 .after").hide();
        $("#step4 .after").hide();
        $(".deadline").hide();
        $('#step3 li').addClass('disabled');
        remove_clockpickers();

        if (state['step'] == 0) {
            // admin sets times, users wait
            $('#step1').removeClass('inactive');
            $("#step1 .during").show();
            for (i = 0; i < 3; i++) {
                add_clockpicker(i);
            }
            $("#step1 input").prop('disabled', false);
        }
        else {
            $("#deadline1-inline").html(state['deadlines'][0]);
            $("#deadline2-inline").html(state['deadlines'][1]);
            $("#deadline3-inline").html(state['deadlines'][2]);
            $("#step2 .time").html(state['deadlines'][0]);
            $("#step3 .time").html(state['deadlines'][1]);
            $("#step4 .time").html(state['deadlines'][2]);
            $("#step1 .after").show();
            $(".deadline").show();
        }
        if (state['step'] == 1) {
            // users and admins vote on options until deadline 1
            $('#step2').removeClass('inactive');
            $("#step2 input").prop('disabled', false);
        }
        if (state['step'] == 2) {
            // admin picks approach, users wait / read until deadline 2
            $('#step3').removeClass('inactive');
            $("#step3 input").prop('disabled', false);
            $('#step3 li').removeClass('disabled');
        }
        if (state['step'] < 3) {
            $("#step4 .before").show();
        }
        else if (state['step'] == 3) {
            // admin can change the ETA, users wait
            $('#step4').removeClass('inactive')
            $("#step4 input").prop('disabled', false);
            add_clockpicker(3);
            $("#step4 .during").show();
        }
        else if (state['step'] == 4) {
            // ETA has passed
            $('#step4').removeClass('inactive');
            $("#step4 .after").show();
        }
        render_options(state['options']);
    }

    socket.on('state change', function(state) {
        update(state);
    });

    $("input#tostep2").on("click", function() {
        var d = [$("input[name=deadlinefield-1]").val(),
                 $("input[name=deadlinefield-2]").val(),
                 $("input[name=deadlinefield-3]").val()];
        $("#step1-error").hide();
        for (var i = 0; i < d.length; i++) {
            if (d[i] == '') {
                $("#step1-error").html("Vul voor alle tijdstippen een waarde in.").show();
                return;
            }
            if (!/[0-9]{2}:[0-9]{2}/.test(d[i])) {
                $("#step1-error").html("'"+d[i]+"' is geen geldig tijdstip.").show();
                return;
            }
            if (i > 0 && d[i-1] > d[i]) {
                $("#step1-error").html("Zorg dat de tijdstippen chronologisch zijn.").show();
                return;
            }
        }
        socket.emit("state update", {"deadlines": d,
                                     "admin_secret": admin_secret});
    });

    $("input#add-option").on("click", function() {
        var newoption = $("input#new-option").val();
        if (newoption != '') {
            socket.emit("new option", {"newoption": newoption});
        }
        $("input#new-option").val("");
    });

    function vote(i) {
        socket.emit("vote", {"option": i});
    }

    update(state);
});